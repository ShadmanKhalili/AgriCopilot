import * as React from 'react';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';
import type { Language } from '../utils/translations';

interface Props {
  children: React.ReactNode;
  /**
   * 'full' (default) replaces the whole application with the reload screen.
   * 'compact' keeps the app shell alive and only replaces the failed tool,
   * so one broken tab cannot take down the farmer's unsaved work.
   */
  variant?: 'full' | 'compact';
  /** Language for the compact fallback (Bengali primary, English secondary). */
  lang?: Language;
  /** Action for the compact fallback's "go home" button. */
  onGoHome?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const errorMsg = String(error?.message || error || '');
    const isChunkLoadError = error?.name === 'TypeError' && 
      (errorMsg.includes('Failed to fetch dynamically imported module') ||
       errorMsg.includes('dynamically imported'));

    if (isChunkLoadError && typeof window !== 'undefined') {
      const storageKey = 'app_chunk_auto_reload';
      const lastReload = Number(sessionStorage.getItem(storageKey) || 0);
      const now = Date.now();
      // Auto-reload once within a 15-second window to fetch fresh bundle
      if (now - lastReload > 15000) {
        sessionStorage.setItem(storageKey, String(now));
        window.location.reload();
        return;
      }
    }
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  /** Retry the failed subtree in place - no full page reload on a slow link. */
  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    this.props.onGoHome?.();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.variant === 'compact') {
        return this.renderCompactFallback();
      }

      let errorMessage = "Something went wrong.";
      let isFirestoreError = false;

      try {
        if (this.state.error?.message) {
          const parsed = JSON.parse(this.state.error.message);
          if (parsed.error && parsed.operationType) {
            errorMessage = `Firestore Error: ${parsed.error} (${parsed.operationType} on ${parsed.path})`;
            isFirestoreError = true;
          }
        }
      } catch (e) {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-red-100 p-8 text-center">
            <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Application Error</h2>
            <p className="text-gray-600 mb-8 leading-relaxed">
              {errorMessage}
            </p>
            {isFirestoreError && (
              <p className="text-xs text-gray-400 mb-6 bg-gray-50 p-3 rounded-xl border border-gray-100 font-mono break-all">
                {this.state.error?.message}
              </p>
            )}
            <button
              onClick={this.handleReset}
              className="w-full bg-green-600 text-white font-bold py-4 rounded-xl hover:bg-green-500 transition-all flex items-center justify-center space-x-2 shadow-lg shadow-green-200"
            >
              <RefreshCcw className="w-5 h-5" />
              <span>Reload Application</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }

  /**
   * Scoped fallback for a single tool/tab. The rest of the app (offline
   * banner, navigation, unsaved chat) stays alive, so a broken tab is a
   * recoverable annoyance instead of a full application wipe.
   */
  private renderCompactFallback() {
    const lang: Language = this.props.lang || 'bn';
    const isBn = lang === 'bn';

    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <div className="bg-red-100 w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-7 h-7 text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-1">
          {isBn ? 'এই টুলটি লোড করা যায়নি' : 'This tool failed to load'}
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          {isBn ? 'This tool failed to load' : 'এই টুলটি লোড করা যায়নি'}
        </p>
        <p className="text-sm text-gray-600 mb-6 leading-relaxed max-w-sm">
          {isBn
            ? 'বাকি সেবাগুলো স্বাভাবিকভাবেই কাজ করছে। আবার চেষ্টা করুন অথবা হোমে ফিরে যান।'
            : 'The rest of the app still works. Try again, or go back to home.'}
        </p>
        {this.state.error?.message && (
          <p className="text-xs text-gray-400 mb-6 bg-gray-50 p-3 rounded-xl border border-gray-100 font-mono break-all max-w-sm">
            {this.state.error.message}
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
          <button
            onClick={this.handleRetry}
            className="flex-1 bg-green-600 text-white font-bold py-3 px-4 rounded-xl hover:bg-green-500 transition-all flex items-center justify-center space-x-2 shadow-lg shadow-green-200"
          >
            <RefreshCcw className="w-4 h-4" />
            <span>{isBn ? 'আবার চেষ্টা করুন' : 'Retry'}</span>
          </button>
          {this.props.onGoHome && (
            <button
              onClick={this.handleGoHome}
              className="flex-1 bg-white text-gray-700 font-bold py-3 px-4 rounded-xl hover:bg-gray-50 transition-all flex items-center justify-center space-x-2 border border-gray-200"
            >
              <Home className="w-4 h-4" />
              <span>{isBn ? 'হোমে ফিরুন' : 'Go to home'}</span>
            </button>
          )}
        </div>
      </div>
    );
  }
}
