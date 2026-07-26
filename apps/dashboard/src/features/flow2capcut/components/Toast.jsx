import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import { TIMING } from '../config/defaults';
import './Toast.css';

// Toast Context
const ToastContext = createContext(null);

// Toast types
const TOAST_TYPES = {
  success: { icon: '✅', className: 'toast-success' },
  error: { icon: '❌', className: 'toast-error' },
  warning: { icon: '⚠️', className: 'toast-warning' },
  info: { icon: 'ℹ️', className: 'toast-info' }
};

// Global toast store for use outside React components
let globalToastFn = null;

export const toast = {
  success: (msg, duration) => globalToastFn?.success(msg, duration),
  error: (msg, duration) => globalToastFn?.error(msg, duration),
  warning: (msg, duration) => globalToastFn?.warning(msg, duration),
  info: (msg, duration) => globalToastFn?.info(msg, duration),
};

// Toast Provider Component
export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 3000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type, duration }]);
    
    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }
    
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Create toast functions
  const toastFns = {
    success: (msg, duration) => addToast(msg, 'success', duration ?? 3000),
    error: (msg, duration) => addToast(msg, 'error', duration ?? 5000),
    warning: (msg, duration) => addToast(msg, 'warning', duration ?? 4000),
    info: (msg, duration) => addToast(msg, 'info', duration ?? 3000),
    remove: removeToast
  };

  // Set global toast function
  useEffect(() => {
    globalToastFn = toastFns;
    return () => { globalToastFn = null; };
  }, [toastFns]);

  return (
    <ToastContext.Provider value={toastFns}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
};

// Toast Container Component
const ToastContainer = ({ toasts, onRemove }) => {
  if (toasts.length === 0) return null;

  return createPortal(
    <div className="toast-container">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>,
    document.body
  );
};

// Single Toast Item
const ToastItem = ({ toast, onRemove }) => {
  const [isExiting, setIsExiting] = useState(false);
  const { icon, className } = TOAST_TYPES[toast.type] || TOAST_TYPES.info;

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => onRemove(toast.id), TIMING.TOAST_EXIT_ANIMATION);
  };

  return (
    <div className={`toast-item ${className} ${isExiting ? 'toast-exit' : ''}`}>
      <span className="toast-icon">{icon}</span>
      <span className="toast-message">{toast.message}</span>
      <button className="toast-close" onClick={handleClose}>×</button>
    </div>
  );
};

// Hook to use toast (for components)
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    // Fallback to console if not in provider
    return {
      success: (msg) => console.log('✅', msg),
      error: (msg) => console.error('❌', msg),
      warning: (msg) => console.warn('⚠️', msg),
      info: (msg) => console.info('ℹ️', msg),
      remove: () => {}
    };
  }
  return context;
};

export default ToastProvider;
