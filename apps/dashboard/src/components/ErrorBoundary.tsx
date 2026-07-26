import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ errorInfo });
    }

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="flex flex-col items-center justify-center h-full p-8 bg-red-50 text-red-900 border border-red-200 rounded-lg m-4">
                    <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
                    <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
                    <p className="text-sm mb-4 text-center max-w-md">
                        The component crashed. Please check the console for more details.
                    </p>
                    {this.state.error && (
                        <div className="bg-white p-4 rounded border border-red-100 w-full max-w-2xl overflow-auto text-xs font-mono">
                            <p className="font-bold text-red-600 mb-2">{this.state.error.toString()}</p>
                            <pre className="text-slate-500">{this.state.errorInfo?.componentStack}</pre>
                        </div>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
