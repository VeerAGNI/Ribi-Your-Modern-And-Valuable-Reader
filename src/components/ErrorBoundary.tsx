import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isFirestoreError: boolean;
  firestoreDetails: any;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    isFirestoreError: false,
    firestoreDetails: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    let isFirestoreError = false;
    let firestoreDetails = null;

    try {
      const parsed = JSON.parse(error.message);
      if (parsed?.operationType && parsed?.error) {
        isFirestoreError = true;
        firestoreDetails = parsed;
      }
    } catch { /* not a structured error */ }

    return { hasError: true, error, isFirestoreError, firestoreDetails };
  }

  public componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error.message, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, isFirestoreError: false, firestoreDetails: null });
  };

  public render() {
    if (!this.state.hasError) return this.props.children;

    const { isFirestoreError, firestoreDetails, error } = this.state;

    return (
      <div className="min-h-screen flex items-center justify-center p-6"
        style={{ background: '#0a0f1e', color: '#F9FAFB' }}>
        <div className="max-w-md w-full rounded-3xl p-8 text-center"
          style={{ background: '#111827', border: '1px solid rgba(239,68,68,0.2)', boxShadow: '0 32px 64px rgba(0,0,0,0.5)' }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
            style={{ background: 'rgba(239,68,68,0.12)' }}>
            <AlertCircle size={32} className="text-red-400" />
          </div>

          <h2 className="text-xl font-bold mb-2 text-white">Something went wrong</h2>

          {isFirestoreError ? (
            <div className="text-left mt-4">
              <p className="text-sm text-slate-400 mb-4">
                A database permission error occurred. This may be due to Firestore security rules.
              </p>
              <div className="rounded-xl p-3 text-xs font-mono text-red-300 mb-4 text-left overflow-auto"
                style={{ background: 'rgba(0,0,0,0.4)' }}>
                <p><span className="opacity-50">operation:</span> {firestoreDetails?.operationType}</p>
                <p><span className="opacity-50">path:</span> {firestoreDetails?.path}</p>
                <p><span className="opacity-50">error:</span> {firestoreDetails?.error}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400 mt-2 mb-4">
              {error?.message || 'An unexpected error occurred.'}
            </p>
          )}

          <div className="flex gap-3 justify-center mt-6">
            <button
              onClick={this.handleReset}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors text-white"
              style={{ background: '#3B82F6' }}
            >
              <RefreshCw size={14} />
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors text-slate-300"
              style={{ background: 'rgba(255,255,255,0.08)' }}
            >
              <RotateCcw size={14} />
              Reload App
            </button>
          </div>
        </div>
      </div>
    );
  }
}
