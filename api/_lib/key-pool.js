// API key 号池模块
//
// 通过环境变量 REMOVE_BG_API_KEYS（逗号分隔）配置多个 remove.bg API key；
// 单 key 配额耗尽（402）或被限流（429）时由上层调用 markExhausted() 标记，
// 后续请求自动跳过该 key。
//
// 状态保存在 module-level Set 中，仅在进程（或 Vercel function 实例）热的
// 时候有效；冷启动会重置，可能会浪费一次试错调用。

// module-level 状态：本进程内已知耗尽的 key 集合。
const exhaustedKeys = new Set();

/**
 * 自定义错误：所有 key 都已耗尽或不可用时抛出。
 * 上层应识别该类型并返回 HTTP 503。
 * 注意：错误信息不得包含具体的 key 字符串，避免日志/响应泄露。
 */
export class QuotaExhaustedError extends Error {
  constructor(message = '所有 API 配额已用完，请稍后重试') {
    super(message);
    this.name = 'QuotaExhaustedError';
  }
}

/**
 * 从环境变量中读取并解析所有配置的 key。
 *
 * 优先级：
 *   1. REMOVE_BG_API_KEYS（逗号分隔的多 key 列表）
 *   2. REMOVE_BG_API_KEY（单 key，向后兼容）
 *
 * 解析规则：trim 每一项并过滤空字符串。
 *
 * @returns {string[]} 配置的所有 key 列表（可能为空数组）
 */
export function loadKeys() {
  const multi = process.env.REMOVE_BG_API_KEYS;
  if (typeof multi === 'string' && multi.length > 0) {
    return multi
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  const single = process.env.REMOVE_BG_API_KEY;
  if (typeof single === 'string' && single.trim().length > 0) {
    return [single.trim()];
  }

  return [];
}

/**
 * 返回当前可用的 key 列表（即配置的 key 中，没有被标记为耗尽的那部分）。
 * 顺序与 loadKeys() 保持一致，便于上层做"粘性 + 故障切换"轮询。
 *
 * @returns {string[]}
 */
export function getAvailableKeys() {
  return loadKeys().filter((key) => !exhaustedKeys.has(key));
}

/**
 * 把指定 key 标记为耗尽。后续 getAvailableKeys() 不会再返回它。
 *
 * @param {string} key
 */
export function markExhausted(key) {
  if (typeof key === 'string' && key.length > 0) {
    exhaustedKeys.add(key);
  }
}

/**
 * 仅供测试使用：清空 module-level 的 exhausted 状态。
 * 生产代码不要调用。
 */
export function _resetForTesting() {
  exhaustedKeys.clear();
}

/**
 * 粘性 + 故障切换执行器。
 *
 * 依次用每个可用 key 调用 `attempt(key)`：
 *   - 返回值即视为成功，直接 resolve（粘性：第一个成功的 key 用到底）
 *   - 抛出标记了 `exhausted: true` 的错误（402/429）→ markExhausted 后切下一个
 *   - 抛出标记了 `transient: true` 的错误（网络抖动）→ 不标记，切下一个重试
 *   - 抛出其他错误 → 立即向上抛（跟具体 key 无关，例如 4xx/5xx）
 *
 * 全部 key 走完仍未成功（全部 402/429 或全部网络错误）→ 抛 QuotaExhaustedError。
 *
 * 把这段逻辑从 handler 中抽出来，便于注入 mock attempt 做单元测试，
 * 覆盖 PRD 要求的"轮询 / 故障切换 / 耗尽报错"三条核心路径。
 *
 * @template T
 * @param {(key: string) => Promise<T>} attempt 用给定 key 执行一次远程调用
 * @returns {Promise<T>}
 */
export async function runWithFailover(attempt) {
  const available = getAvailableKeys();
  if (available.length === 0) {
    throw new QuotaExhaustedError('所有 API 配额已用完，请稍后重试');
  }

  for (const key of available) {
    try {
      return await attempt(key);
    } catch (error) {
      if (error && error.exhausted) {
        markExhausted(key);
        continue;
      }
      if (error && error.transient) {
        // 网络抖动：不标记 exhausted，换下一个 key 重试。
        continue;
      }
      // 其他错误跟 key 无关，立即抛出（保持原 handler 行为）。
      throw error;
    }
  }

  // 全部 key 都失败（402/429 或网络错误）。
  throw new QuotaExhaustedError('所有 API 配额已用完，请稍后重试');
}
