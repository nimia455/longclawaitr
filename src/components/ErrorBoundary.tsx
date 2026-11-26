import React from 'react';
import { RefreshCw, RotateCcw } from 'lucide-react';
import { LongclawLogo } from './Icons';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

function detectLang(): 'en' | 'tr' {
  try {
    const saved = localStorage.getItem('lc_lang');
    if (saved === 'tr' || saved === 'en') return saved;
    if (typeof document !== 'undefined' && document.documentElement.lang === 'tr') return 'tr';
    if (typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('tr')) {
      return 'tr';
    }
  } catch {}
  return 'en';
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || '',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Longclaw boundary caught render error:', error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  handleReload = () => {
    try {
      window.location.reload();
    } catch {
      this.handleRetry();
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const isTr = detectLang() === 'tr';

    return (
      <div className="min-h-screen bg-[var(--bg)] text-[var(--tx)] flex items-center justify-center p-6 font-sans antialiased">
        <div className="w-full max-w-md rounded-3xl bg-[var(--card)] border border-[var(--bd)] p-7 sm:p-8 shadow-xl text-center">
          <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-[var(--surf)] border border-[var(--bd)] flex items-center justify-center">
            <LongclawLogo className="w-8 h-8 text-[var(--tx)]" />
          </div>

          <h1 className="font-serif-fraunces text-2xl font-medium tracking-tight text-[var(--tx)] mb-2">
            {isTr ? 'Beklenmedik bir sorun oluştu' : 'Something unexpected happened'}
          </h1>

          <p className="text-sm text-[var(--mut)] leading-relaxed mb-6">
            {isTr
              ? 'Sohbetlerin güvende. Devam etmek için tekrar deneyebilir veya sayfayı yenileyebilirsin.'
              : 'Your conversations are safe. You can retry right away or reload the page to continue.'}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={this.handleRetry}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[var(--ac)] text-[var(--on)] text-sm font-medium hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{isTr ? 'Tekrar dene' : 'Try again'}</span>
            </button>

            <button
              type="button"
              onClick={this.handleReload}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[var(--surf)] border border-[var(--bd)] text-[var(--tx)] text-sm font-medium hover:bg-[var(--bg)] transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>{isTr ? 'Sayfayı yenile' : 'Reload page'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }
}
