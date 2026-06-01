import { FormEvent, useState } from 'react';
import { storePassword } from '../lib/auth';
import { GradientBlinds } from './GradientBlinds';

type Props = {
  onAuth: () => void;
};

// 模块级常量：稳定引用，避免每次输入触发 GradientBlinds 的 WebGL 重建
const GATE_GRADIENT = ['#0e4fd0', '#2468f2', '#66a5ff'];

export function PasswordGate({ onAuth }: Props) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // 动画为 RAF 驱动，CSS 的 prefers-reduced-motion 停不了它，故在此显式探测并 paused
  const [reduceMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password) {
      setError('请输入访问密码');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/health', {
        method: 'GET',
        headers: { 'X-Access-Password': password }
      });

      if (response.ok) {
        storePassword(password);
        onAuth();
        return;
      }

      if (response.status === 401) {
        setError('密码错误，请重试');
      } else {
        setError(`服务暂不可用，请稍后重试（${response.status}）`);
      }
    } catch {
      setError('网络异常，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="gate-shell">
      <GradientBlinds
        className="gate-bg"
        gradientColors={GATE_GRADIENT}
        mixBlendMode="normal"
        angle={20}
        noise={0.15}
        blindCount={14}
        spotlightRadius={0.6}
        paused={reduceMotion}
      />
      <form className="gate-card" onSubmit={handleSubmit} aria-label="访问密码">
        <h1>BG Remover</h1>
        <p>请输入访问密码进入</p>
        <input
          autoFocus
          className="gate-input"
          type="password"
          autoComplete="current-password"
          placeholder="访问密码"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={submitting}
          aria-invalid={!!error}
          aria-describedby={error ? 'gate-error' : undefined}
        />
        <button className="gate-submit" type="submit" disabled={submitting} aria-busy={submitting}>
          {submitting ? '校验中…' : '进入'}
        </button>
        {error && (
          <div className="gate-error" id="gate-error" role="alert" aria-live="assertive">
            {error}
          </div>
        )}
      </form>
    </main>
  );
}
