import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from 'react';
import { PasswordGate } from './components/PasswordGate';
import { clearPassword, getStoredPassword } from './lib/auth';
import { compressImage } from './lib/compress';

type ProcessStatus = 'idle' | 'ready' | 'processing' | 'done' | 'error';
type TargetType = 'person' | 'product' | 'auto';
type SizeMode = 'auto' | 'preview' | 'full' | '50MP';

type HistoryItem = {
  id: string;
  fileName: string;
  size: string;
  createdAt: string;
  provider: string;
};

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

const targetOptions: Array<{ value: TargetType; label: string; hint: string }> = [
  { value: 'person', label: '人物优先', hint: '减少人物边缘漏抠' },
  { value: 'product', label: '商品优先', hint: '适合产品主图' },
  { value: 'auto', label: '自动识别', hint: '通用图片处理' }
];

const sizeOptions: Array<{ value: SizeMode; label: string }> = [
  { value: 'auto', label: '自动尺寸' },
  { value: 'preview', label: '预览图' },
  { value: 'full', label: '原图尺寸' }
];

function formatBytes(bytes: number) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function safeBaseName(name: string) {
  const dotIndex = name.lastIndexOf('.');
  const withoutExt = dotIndex > 0 ? name.slice(0, dotIndex) : name;

  return (
    withoutExt
      .trim()
      .replace(/[^a-zA-Z0-9一-龥_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'image'
  );
}

function makeResultName(sourceName: string) {
  return `${safeBaseName(sourceName)}-transparent.png`;
}

function LogoIcon() {
  return (
    <svg className="logo-icon" viewBox="0 0 48 48" aria-hidden="true">
      <rect x="4" y="4" width="40" height="40" rx="12" />
      <path d="M14 29.5 24 14l10 15.5" />
      <path d="M14 29.5c6.8 3.9 13.5 4 20 0" />
      <path d="M17.8 21.5c2-2.3 4.1-3.5 6.4-3.5 2.8 0 5.4 1.5 7.6 4.5" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg className="upload-icon" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 22V7" />
      <path d="M10 13l6-6 6 6" />
      <path d="M8 24.5h16" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg className="button-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M5 20h14" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path d="M4 12h16" />
      <path d="M12 4c2.2 2.2 3.2 4.8 3.2 8s-1 5.8-3.2 8" />
      <path d="M12 4c-2.2 2.2-3.2 4.8-3.2 8s1 5.8 3.2 8" />
    </svg>
  );
}

function FeatureIcon({ type }: { type: 'ai' | 'speed' | 'privacy' | 'hd' }) {
  const paths = {
    ai: (
      <>
        <path d="M8 18V8h6" />
        <path d="M8 13h5" />
        <path d="M17 8v10" />
      </>
    ),
    speed: (
      <>
        <path d="M14 3 6 15h7l-1 6 8-12h-7l1-6Z" />
      </>
    ),
    privacy: (
      <>
        <path d="M12 4 5.5 6.8v5.4c0 4 2.7 6.8 6.5 8 3.8-1.2 6.5-4 6.5-8V6.8L12 4Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    hd: (
      <>
        <rect x="5" y="7" width="14" height="10" rx="2" />
        <path d="M8 14V10" />
        <path d="M11 10v4" />
        <path d="M8 12h3" />
        <path d="M14 10v4h1.5a2 2 0 0 0 0-4H14Z" />
      </>
    )
  };

  return (
    <svg className={`feature-icon ${type}`} viewBox="0 0 24 24" aria-hidden="true">
      {paths[type]}
    </svg>
  );
}

function DemoPlant() {
  return (
    <div className="demo-plant" aria-hidden="true">
      <span className="leaf l1" />
      <span className="leaf l2" />
      <span className="leaf l3" />
      <span className="leaf l4" />
      <span className="leaf l5" />
      <span className="leaf l6" />
      <span className="pot" />
    </div>
  );
}

function ComparisonCard({ sourceUrl, resultUrl, status }: { sourceUrl: string; resultUrl: string; status: ProcessStatus }) {
  return (
    <div className="comparison-card" aria-label="处理前后对比">
      <div className="compare-pane compare-before">
        <span className="pane-badge dark">原图</span>
        {sourceUrl ? <img src={sourceUrl} alt="原图预览" /> : <DemoPlant />}
      </div>
      <div className="compare-pane compare-after">
        <span className="pane-badge blue">处理后</span>
        {resultUrl ? <img src={resultUrl} alt="移除背景后的透明图片" /> : <DemoPlant />}
      </div>
      <div className="compare-divider">
        <span>‹›</span>
      </div>
      {status === 'processing' && (
        <div className="processing-overlay" role="status">
          <span className="pulse-dot" />
          <p>正在识别主体并生成透明 PNG</p>
        </div>
      )}
    </div>
  );
}

function App() {
  const [authed, setAuthed] = useState<boolean>(() => getStoredPassword() !== null);

  if (!authed) {
    return <PasswordGate onAuth={() => setAuthed(true)} />;
  }

  return <MainApp />;
}

function MainApp() {
  const inputRef = useRef<HTMLInputElement>(null);
  const jobIdRef = useRef(0);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState('');
  const [resultUrl, setResultUrl] = useState('');
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [status, setStatus] = useState<ProcessStatus>('idle');
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [targetType, setTargetType] = useState<TargetType>('person');
  const [sizeMode, setSizeMode] = useState<SizeMode>('auto');
  const [provider, setProvider] = useState('');

  const resultFileName = useMemo(() => (sourceFile ? makeResultName(sourceFile.name) : 'transparent-background.png'), [sourceFile]);
  const canProcess = sourceFile !== null && status !== 'processing';

  useEffect(() => {
    return () => {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    };
  }, [sourceUrl]);

  useEffect(() => {
    return () => {
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    };
  }, [resultUrl]);

  function clearResult() {
    setResultUrl('');
    setResultBlob(null);
    setProvider('');
  }

  function validateFile(file: File) {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return '请上传 PNG、JPG 或 WebP 图片。';
    }

    if (file.size > MAX_FILE_SIZE) {
      return '图片过大，请选择 20 MB 以内的文件。';
    }

    return '';
  }

  function loadFile(file: File) {
    const validationMessage = validateFile(file);
    if (validationMessage) {
      setError(validationMessage);
      setStatus('error');
      return;
    }

    clearResult();
    setError('');
    setSourceFile(file);
    setSourceUrl(URL.createObjectURL(file));
    setStatus('ready');
    void processImage(file, targetType, sizeMode);
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) loadFile(file);
    event.target.value = '';
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) loadFile(file);
  }

  function handleSignOut() {
    clearPassword();
    window.location.reload();
  }

  async function processImage(file = sourceFile, selectedTarget = targetType, selectedSize = sizeMode) {
    if (!file) return;

    const jobId = jobIdRef.current + 1;
    jobIdRef.current = jobId;
    clearResult();
    setStatus('processing');
    setError('');

    try {
      const compressed = await compressImage(file);
      if (jobIdRef.current !== jobId) return;

      const password = getStoredPassword();
      if (!password) {
        // 密码丢失（用户在其他标签清除了 localStorage 等）
        clearPassword();
        window.location.reload();
        return;
      }

      const response = await fetch('/api/remove-bg', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Access-Password': password
        },
        body: JSON.stringify({
          image: compressed.dataUrl,
          targetType: selectedTarget,
          size: selectedSize
        })
      });

      if (response.status === 401) {
        // 密码失效：清除存储并 reload 回登录页
        clearPassword();
        window.location.reload();
        return;
      }

      if (response.status === 503) {
        throw new Error('所有 API 配额已用完，请稍后重试');
      }

      if (!response.ok) {
        const message = await readErrorMessage(response);
        throw new Error(message);
      }

      const responseType = response.headers.get('content-type') || '';
      if (!responseType.toLowerCase().includes('image/png')) {
        throw new Error('服务端未返回透明 PNG，请检查背景移除服务配置。');
      }

      const blob = new Blob([await response.arrayBuffer()], { type: 'image/png' });
      const objectUrl = URL.createObjectURL(blob);
      const providerName = response.headers.get('X-Remove-Bg-Provider') || 'remove.bg';

      if (jobIdRef.current !== jobId) {
        URL.revokeObjectURL(objectUrl);
        return;
      }

      setResultBlob(blob);
      setResultUrl(objectUrl);
      setProvider(providerName);
      setStatus('done');
      setHistory((items) =>
        [
          {
            id: crypto.randomUUID(),
            fileName: file.name,
            size: formatBytes(blob.size),
            provider: providerName,
            createdAt: new Intl.DateTimeFormat('zh-CN', {
              hour: '2-digit',
              minute: '2-digit'
            }).format(new Date())
          },
          ...items
        ].slice(0, 3)
      );
    } catch (reason) {
      if (jobIdRef.current !== jobId) return;
      setStatus('error');
      setError(reason instanceof Error ? reason.message : '背景移除失败，请换一张图片重试。');
    }
  }

  function retryWithTarget(nextTarget: TargetType) {
    setTargetType(nextTarget);
    if (sourceFile && status !== 'processing') {
      void processImage(sourceFile, nextTarget, sizeMode);
    }
  }

  function retryWithSize(nextSize: SizeMode) {
    setSizeMode(nextSize);
    if (sourceFile && status !== 'processing') {
      void processImage(sourceFile, targetType, nextSize);
    }
  }

  function downloadResult() {
    if (!resultBlob || !resultUrl) return;

    const anchor = document.createElement('a');
    anchor.href = resultUrl;
    anchor.download = resultFileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  return (
    <main className="app-shell">
      <nav className="topbar" aria-label="主导航">
        <a className="brand" href="/" aria-label="BG Remover 首页">
          <LogoIcon />
          <span>BG Remover</span>
        </a>
        <div className="nav-links" aria-label="页面导航">
          <a className="active" href="#home">首页</a>
          <a href="#how">使用方法</a>
        </div>
        <div className="nav-actions">
          <button className="language-button" type="button">
            <GlobeIcon />
            简体中文
            <span className="chevron">⌄</span>
          </button>
          <button className="login-button" type="button" onClick={handleSignOut}>退出登录</button>
        </div>
      </nav>

      <section className="hero-section" id="home">
        <div className="hero-copy">
          <h1>
            免费在线
            <span>移除图片背景</span>
          </h1>
          <p className="hero-lede">一键自动移除图片背景，快速获得透明背景 PNG 图片</p>

          <div
            role="button"
            tabIndex={0}
            className={`upload-card ${isDragging ? 'dragging' : ''}`}
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                inputRef.current?.click();
              }
            }}
          >
            <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleInputChange} />
            <button
              className="upload-button"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                inputRef.current?.click();
              }}
            >
              <UploadIcon />
              上传图片
            </button>
            <strong>或拖拽图片到此处上传</strong>
            <small>支持 JPG、PNG、WebP，最大 20MB（上传前会自动压缩）</small>
          </div>

          <div className="control-row" aria-label="处理模式">
            {targetOptions.map((option) => (
              <button
                className={targetType === option.value ? 'mode-chip active' : 'mode-chip'}
                disabled={status === 'processing'}
                key={option.value}
                onClick={() => retryWithTarget(option.value)}
                type="button"
              >
                <span>{option.label}</span>
                <small>{option.hint}</small>
              </button>
            ))}
          </div>

          <div className="quality-row">
            {sizeOptions.map((option) => (
              <button
                key={option.value}
                className={sizeMode === option.value ? 'quality-chip active' : 'quality-chip'}
                disabled={status === 'processing'}
                onClick={() => retryWithSize(option.value)}
                type="button"
              >
                {option.label}
              </button>
            ))}
            {sourceFile && (
              <button className="text-action" disabled={!canProcess} onClick={() => processImage()} type="button">
                重新处理
              </button>
            )}
          </div>

          {error && <div className="inline-error">{error}</div>}
        </div>

        <div className="hero-visual">
          <ComparisonCard sourceUrl={sourceUrl} resultUrl={resultUrl} status={status} />
          <div className="result-actions">
            <div>
              <span>当前文件</span>
              <strong>{sourceFile ? sourceFile.name : '尚未选择图片'}</strong>
              {provider && <small>处理引擎：{provider}</small>}
            </div>
            <button className="download-action" onClick={downloadResult} disabled={!resultBlob} type="button">
              <DownloadIcon />
              下载透明 PNG
            </button>
          </div>
        </div>
      </section>

      <section className="feature-strip" aria-label="核心能力">
        <article>
          <FeatureIcon type="ai" />
          <div>
            <h2>AI 智能识别</h2>
            <p>自动识别主体，精确移除背景</p>
          </div>
        </article>
        <article>
          <FeatureIcon type="speed" />
          <div>
            <h2>快速处理</h2>
            <p>服务端处理，页面不再被模型阻塞</p>
          </div>
        </article>
        <article>
          <FeatureIcon type="privacy" />
          <div>
            <h2>密码保护</h2>
            <p>预共享密码守门，避免链接被外人滥用</p>
          </div>
        </article>
        <article>
          <FeatureIcon type="hd" />
          <div>
            <h2>高清输出</h2>
            <p>输出透明背景 PNG 图片</p>
          </div>
        </article>
      </section>

      <section className="how-section" id="how" aria-label="如何使用">
        <h2>如何使用</h2>
        <div className="steps-row">
          <article>
            <span className="step-number">1</span>
            <UploadIcon />
            <h3>上传图片</h3>
            <p>上传需要移除背景的图片</p>
          </article>
          <article>
            <span className="step-number">2</span>
            <FeatureIcon type="ai" />
            <h3>AI 自动处理</h3>
            <p>自动识别并移除背景</p>
          </article>
          <article>
            <span className="step-number">3</span>
            <DownloadIcon />
            <h3>下载图片</h3>
            <p>下载透明背景的 PNG 图片</p>
          </article>
        </div>
      </section>

      {history.length > 0 && (
        <section className="history-section" aria-label="处理记录">
          <h2>最近处理</h2>
          <ul>
            {history.map((item) => (
              <li key={item.id}>
                <span>{item.fileName}</span>
                <small>
                  {item.size} · {item.provider} · {item.createdAt}
                </small>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

async function readErrorMessage(response: Response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = (await response.json()) as { message?: string };
    return data.message || '背景移除失败，请换一张图片重试。';
  }

  const text = await response.text();
  return text || '背景移除失败，请换一张图片重试。';
}

export default App;
