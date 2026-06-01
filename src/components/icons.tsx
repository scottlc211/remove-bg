// 可复用的纯展示型 SVG 图标，供落地页与工具页共用。

export function LogoIcon() {
  return (
    <svg className="logo-icon" viewBox="0 0 48 48" aria-hidden="true">
      <rect x="4" y="4" width="40" height="40" rx="12" />
      <path d="M14 29.5 24 14l10 15.5" />
      <path d="M14 29.5c6.8 3.9 13.5 4 20 0" />
      <path d="M17.8 21.5c2-2.3 4.1-3.5 6.4-3.5 2.8 0 5.4 1.5 7.6 4.5" />
    </svg>
  );
}

export function UploadIcon() {
  return (
    <svg className="upload-icon" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 22V7" />
      <path d="M10 13l6-6 6 6" />
      <path d="M8 24.5h16" />
    </svg>
  );
}

export function DownloadIcon() {
  return (
    <svg className="button-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M5 20h14" />
    </svg>
  );
}

export function GlobeIcon() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path d="M4 12h16" />
      <path d="M12 4c2.2 2.2 3.2 4.8 3.2 8s-1 5.8-3.2 8" />
      <path d="M12 4c-2.2 2.2-3.2 4.8-3.2 8s1 5.8 3.2 8" />
    </svg>
  );
}

export function FeatureIcon({ type }: { type: 'ai' | 'speed' | 'privacy' | 'hd' }) {
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
