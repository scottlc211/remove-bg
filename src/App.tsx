import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from 'react';
import { LandingPage } from './components/LandingPage';
import { DownloadIcon, LogoIcon, UploadIcon } from './components/icons';
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
    return <LandingPage onAuth={() => setAuthed(true)} />;
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
        <div className="nav-actions">
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
