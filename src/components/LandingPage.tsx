import { useState } from 'react';
import { AuthCard } from './AuthCard';
import { GradientBlinds } from './GradientBlinds';
import { DownloadIcon, FeatureIcon, GlobeIcon, LogoIcon, UploadIcon } from './icons';

type Props = {
  onAuth: () => void;
};

// 模块级常量：稳定引用，避免每次渲染触发 GradientBlinds 的 WebGL 重建
const GATE_GRADIENT = ['#031014', '#123326', '#57c466'];

export function LandingPage({ onAuth }: Props) {
  // 动画为 RAF 驱动，CSS 的 prefers-reduced-motion 停不了它，故在此显式探测并 paused
  const [reduceMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  return (
    <main className="landing-shell">
      <nav className="topbar landing-nav" aria-label="主导航">
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
          <a className="login-button nav-cta" href="#auth">登录 →</a>
        </div>
      </nav>

      <section className="landing-hero" id="home" aria-label="产品介绍与登录">
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
        <div className="hero-scrim" aria-hidden="true" />
        <div className="hero-copy-dark">
          <h1>
            免费在线
            <span>移除图片背景</span>
          </h1>
          <p className="hero-lede">一键自动移除图片背景，快速获得透明背景 PNG 图片</p>
          <ul className="hero-points">
            <li>AI 智能识别主体</li>
            <li>服务端处理，秒级出图</li>
            <li>密码保护，私享访问</li>
            <li>高清透明 PNG 输出</li>
          </ul>
        </div>
        <div className="hero-auth" id="auth">
          <AuthCard onAuth={onAuth} />
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
    </main>
  );
}
