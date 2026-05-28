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
 * 上层（Express 错误中间件）应识别该类型并返回 HTTP 503。
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
