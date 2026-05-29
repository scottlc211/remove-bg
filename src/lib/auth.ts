// 访问密码客户端存储。
//
// 密码在用户首次登录时存进 localStorage；之后每次请求附在 X-Access-Password
// 头里。后端 401 时调用方应清除并要求重新输入。
//
// 注意：localStorage 不是安全存储，密码只是"低门槛准入"用途，
// 严肃场景需要换成基于 token 的鉴权。

const STORAGE_KEY = 'remove-bg-access-password';

export function getStoredPassword(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function storePassword(pw: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, pw);
  } catch {
    // 静默吞掉（如隐私模式下的 localStorage 拒写），UI 层无需暴露
  }
}

export function clearPassword(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 同上
  }
}
