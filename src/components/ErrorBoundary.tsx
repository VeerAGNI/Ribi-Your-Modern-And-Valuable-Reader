import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = this.state.error?.message || 'An unexpected error occurred.';
      let isFirestoreError = false;
      let firestoreDetails = null;

      try {
        const parsed = JSON.parse(errorMessage);
        if (parsed.operationType && parsed.error) {
          isFirestoreError = true;
          firestoreDetails = parsed;
        }
      } catch (e) {
        // Not a JSON error message
      }

      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 text-white">
          <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl max-w-2xl w-full border border-red-500/20">
            <h1 className="text-2xl font-bold text-red-400 mb-4 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
              Something went wrong
            </h1>

            {isFirestoreError ? (
              <div className="space-y-4">
                <p className="text-slate-300">
                  A database permission error occurred. This usually means the security rules need to be updated.
                </p>
                <div className="bg-slate-950 p-4 rounded-lg overflow-auto text-sm font-mono text-red-300">
                  <p><strong>Operation:</strong> {firestoreDetails.operationType}</p>
                  <p><strong>Path:</strong> {firestoreDetails.path}</p>
                  <p><strong>Error:</strong> {firestoreDetails.error}</p>
                </div>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-6 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                >
                  Reload Application
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-slate-300">{errorMessage}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-6 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                >
                  Reload Application
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
