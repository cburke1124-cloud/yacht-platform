import React, { Component, ReactNode } from 'react';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';

// ============================================
// TYPE DEFINITIONS
// ============================================

type LoadingSize = 'sm' | 'md' | 'lg' | 'xl';
type SkeletonType = 'card' | 'list' | 'table';

interface LoadingSpinnerProps {
  size?: LoadingSize;
  text?: string;
}

interface LoadingOverlayProps {
  isLoading: boolean;
  children: ReactNode;
}

interface LoadingSkeletonProps {
  type?: SkeletonType;
  count?: number;
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

interface AsyncButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  onClick?: () => void | Promise<void>;
  children: ReactNode;
  isLoading?: boolean;
  loadingText?: string;
  className?: string;
  disabled?: boolean;
}

// ============================================
// LOADING COMPONENTS
// ============================================

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  text = '' 
}) => {
  const sizes: Record<LoadingSize, string> = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16'
  };

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <Loader2 className={`${sizes[size]} animate-spin text-blue-600`} />
      {text && <p className="text-sm text-gray-600">{text}</p>}
    </div>
  );
};

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ 
  isLoading, 
  children 
}) => {
  if (!isLoading) return <>{children}</>;

  return (
    <div className="relative">
      {children}
      <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
        <LoadingSpinner size="lg" />
      </div>
    </div>
  );
};

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({ 
  type = 'card', 
  count = 1 
}) => {
  const skeletons: Record<SkeletonType, React.ReactElement> = {
    card: (
      <div className="bg-white rounded-lg shadow-sm p-4 space-y-3 animate-pulse">
        <div className="h-48 bg-gray-200 rounded-md"></div>
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        <div className="h-6 bg-gray-200 rounded w-1/4"></div>
      </div>
    ),
    list: (
      <div className="bg-white rounded-lg shadow-sm p-4 space-y-3 animate-pulse">
        <div className="flex gap-4">
          <div className="h-20 w-20 bg-gray-200 rounded-md"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    ),
    table: (
      <div className="bg-white rounded-lg shadow-sm p-4 space-y-2 animate-pulse">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 bg-gray-200 rounded"></div>
        ))}
      </div>
    )
  };

  return (
    <>
      {[...Array(count)].map((_, i) => (
        <div key={i}>{skeletons[type]}</div>
      ))}
    </>
  );
};

// ============================================
// ERROR BOUNDARY
// ============================================

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null 
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.setState({
      error,
      errorInfo
    });

    console.error('Error Boundary Caught:', error, errorInfo);
    
    if (process.env.NODE_ENV === 'production') {
      fetch('/api/log-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: error.toString(),
          errorInfo: errorInfo.componentStack,
          timestamp: new Date().toISOString()
        })
      }).catch(console.error);
    }
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="h-8 w-8 text-red-600" />
              <h1 className="text-xl font-bold text-gray-900">
                Oops! Something went wrong
              </h1>
            </div>
            
            <p className="text-gray-600 mb-6">
              We're sorry for the inconvenience. The application encountered an unexpected error.
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mb-4 p-4 bg-red-50 rounded-md text-sm">
                <summary className="cursor-pointer font-semibold text-red-900 mb-2">
                  Error Details (Development Only)
                </summary>
                <pre className="text-xs text-red-800 overflow-auto">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition"
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ============================================
// ASYNC BUTTON WITH LOADING STATE
// ============================================

export const AsyncButton: React.FC<AsyncButtonProps> = ({ 
  onClick, 
  children, 
  isLoading = false, 
  loadingText = 'Loading...',
  className = '',
  disabled = false,
  ...props 
}) => {
  return (
    <button
      onClick={onClick}
      disabled={isLoading || disabled}
      className={`flex items-center justify-center gap-2 px-4 py-2 rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      {...props}
    >
      {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
      {isLoading ? loadingText : children}
    </button>
  );
};

export default LoadingSpinner;
