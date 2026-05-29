import { FormEvent, useState } from 'react';
import { storePassword } from '../lib/auth';

type Props = {
  onAuth: () => void;
};

export function PasswordGate({ onAuth }: Props) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
        />
        <button className="gate-submit" type="submit" disabled={submitting}>
          {submitting ? '校验中…' : '进入'}
        </button>
        {error && <div className="gate-error">{error}</div>}
      </form>
    </main>
  );
}
