import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  loadKeys,
  getAvailableKeys,
  markExhausted,
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
