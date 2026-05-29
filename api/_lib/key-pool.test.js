import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  loadKeys,
  getAvailableKeys,
  markExhausted,
  runWithFailover,
  QuotaExhaustedError,
  _resetForTesting
} from './key-pool.js';

function setEnv(values) {
  delete process.env.REMOVE_BG_API_KEYS;
  delete process.env.REMOVE_BG_API_KEY;
  for (const [name, value] of Object.entries(values)) {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
}

describe('key-pool: loadKeys', () => {
  beforeEach(() => {
    _resetForTesting();
  });

  it('解析 REMOVE_BG_API_KEYS 逗号分隔的多 key', () => {
    setEnv({ REMOVE_BG_API_KEYS: 'keyA,keyB,keyC' });
    assert.deepEqual(loadKeys(), ['keyA', 'keyB', 'keyC']);
  });

  it('trim 每个 key 并过滤空白项', () => {
    setEnv({ REMOVE_BG_API_KEYS: ' keyA , , keyB ,' });
    assert.deepEqual(loadKeys(), ['keyA', 'keyB']);
  });

  it('回退到 REMOVE_BG_API_KEY 单 key 作为向后兼容', () => {
    setEnv({ REMOVE_BG_API_KEY: 'legacyKey' });
    assert.deepEqual(loadKeys(), ['legacyKey']);
  });

  it('优先使用 REMOVE_BG_API_KEYS 而不是 REMOVE_BG_API_KEY', () => {
    setEnv({
      REMOVE_BG_API_KEYS: 'keyA,keyB',
      REMOVE_BG_API_KEY: 'legacyKey'
    });
    assert.deepEqual(loadKeys(), ['keyA', 'keyB']);
  });

  it('两个变量都没设置时返回空数组', () => {
    setEnv({});
    assert.deepEqual(loadKeys(), []);
  });
});

describe('key-pool: getAvailableKeys', () => {
  beforeEach(() => {
    _resetForTesting();
    setEnv({ REMOVE_BG_API_KEYS: 'keyA,keyB,keyC' });
  });

  it('所有 key 都未耗尽时返回完整列表，顺序与配置一致', () => {
    const available = getAvailableKeys();
    assert.deepEqual(available, ['keyA', 'keyB', 'keyC']);
    // 第一个就是粘性使用的 key
    assert.equal(available[0], 'keyA');
  });

  it('第一个 key 被 markExhausted 后跳过它，返回剩余 key', () => {
    markExhausted('keyA');
    const available = getAvailableKeys();
    assert.deepEqual(available, ['keyB', 'keyC']);
    assert.equal(available[0], 'keyB');
  });

  it('所有 key 都 exhausted 时返回空数组', () => {
    markExhausted('keyA');
    markExhausted('keyB');
    markExhausted('keyC');
    assert.deepEqual(getAvailableKeys(), []);
  });

  it('markExhausted 一个不存在于配置中的 key 不影响其他 key', () => {
    markExhausted('keyX');
    assert.deepEqual(getAvailableKeys(), ['keyA', 'keyB', 'keyC']);
  });

  it('_resetForTesting 后所有 key 重新可用', () => {
    markExhausted('keyA');
    markExhausted('keyB');
    _resetForTesting();
    assert.deepEqual(getAvailableKeys(), ['keyA', 'keyB', 'keyC']);
  });
});

describe('key-pool: QuotaExhaustedError', () => {
  it('是 Error 的子类', () => {
    const error = new QuotaExhaustedError();
    assert.ok(error instanceof Error);
    assert.ok(error instanceof QuotaExhaustedError);
  });

  it('有默认中文消息', () => {
    const error = new QuotaExhaustedError();
    assert.equal(error.message, '所有 API 配额已用完，请稍后重试');
    assert.equal(error.name, 'QuotaExhaustedError');
  });

  it('支持自定义消息', () => {
    const error = new QuotaExhaustedError('所有 API key 都已耗尽或不可用');
    assert.equal(error.message, '所有 API key 都已耗尽或不可用');
  });

  it('错误信息默认不包含具体 key 值', () => {
    const error = new QuotaExhaustedError();
    assert.ok(!error.message.includes('keyA'));
    assert.ok(!error.message.includes('JS2rh9pE'));
  });
});

function exhaustedError() {
  const error = new Error('配额耗尽或被限流');
  error.exhausted = true;
  return error;
}

function transientError() {
  const error = new Error('网络抖动');
  error.transient = true;
  return error;
}

describe('key-pool: runWithFailover', () => {
  beforeEach(() => {
    _resetForTesting();
    setEnv({ REMOVE_BG_API_KEYS: 'keyA,keyB,keyC' });
  });

  it('粘性使用：第一个 key 成功就直接返回，不尝试其他 key', async () => {
    const tried = [];
    const result = await runWithFailover(async (key) => {
      tried.push(key);
      return `ok-${key}`;
    });
    assert.equal(result, 'ok-keyA');
    assert.deepEqual(tried, ['keyA']);
  });

  it('故障切换：keyA 返回 402(exhausted) 时自动切到 keyB 完成', async () => {
    const tried = [];
    const result = await runWithFailover(async (key) => {
      tried.push(key);
      if (key === 'keyA') throw exhaustedError();
      return `ok-${key}`;
    });
    assert.equal(result, 'ok-keyB');
    assert.deepEqual(tried, ['keyA', 'keyB']);
    // keyA 被标记为耗尽，后续不再可用
    assert.deepEqual(getAvailableKeys(), ['keyB', 'keyC']);
  });

  it('耗尽报错：所有 key 都 402 时抛 QuotaExhaustedError 且不泄露 key', async () => {
    await assert.rejects(
      runWithFailover(async () => {
        throw exhaustedError();
      }),
      (error) => {
        assert.ok(error instanceof QuotaExhaustedError);
        assert.equal(error.message, '所有 API 配额已用完，请稍后重试');
        assert.ok(!error.message.includes('keyA'));
        return true;
      }
    );
    // 全部被标记耗尽
    assert.deepEqual(getAvailableKeys(), []);
  });

  it('没有可用 key 时直接抛 QuotaExhaustedError，attempt 不被调用', async () => {
    markExhausted('keyA');
    markExhausted('keyB');
    markExhausted('keyC');
    let called = false;
    await assert.rejects(
      runWithFailover(async () => {
        called = true;
        return 'ok';
      }),
      QuotaExhaustedError
    );
    assert.equal(called, false);
  });

  it('网络抖动(transient)不标记耗尽，但仍切换到下一个 key 重试', async () => {
    const result = await runWithFailover(async (key) => {
      if (key === 'keyA') throw transientError();
      return `ok-${key}`;
    });
    assert.equal(result, 'ok-keyB');
    // transient 不应把 keyA 标记为耗尽
    assert.deepEqual(getAvailableKeys(), ['keyA', 'keyB', 'keyC']);
  });

  it('非 402/429 的普通错误立即向上抛出，不切换 key', async () => {
    const tried = [];
    await assert.rejects(
      runWithFailover(async (key) => {
        tried.push(key);
        throw new Error('remove.bg 服务端 500');
      }),
      (error) => {
        assert.ok(!(error instanceof QuotaExhaustedError));
        assert.equal(error.message, 'remove.bg 服务端 500');
        return true;
      }
    );
    // 只尝试了第一个 key，没有切换
    assert.deepEqual(tried, ['keyA']);
    // 也没有把 keyA 标记为耗尽
    assert.deepEqual(getAvailableKeys(), ['keyA', 'keyB', 'keyC']);
  });
});
