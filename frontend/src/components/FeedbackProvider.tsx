import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface FeedbackContextValue {
  toast: {
    success: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
  };
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export function useFeedback(): FeedbackContextValue {
  const ctx = useContext(FeedbackContext);
  if (!ctx) {
    throw new Error('useFeedback must be used within a FeedbackProvider');
  }
  return ctx;
}

export interface BottomSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: number;
  className?: string;
  overlayClassName?: string;
  children: React.ReactNode;
}

export const BottomSheetModal: React.FC<BottomSheetModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  footer,
  maxWidth,
  className = '',
  overlayClassName = '',
  children,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className={`modal-overlay ${overlayClassName}`.trim()}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`modal ${className}`.trim()}
        style={maxWidth ? { maxWidth } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-handle" aria-hidden="true" />
        <div className="modal-header">
          <div className="modal-header-titles">
            <div className="modal-title-row">
              {icon && <span className="modal-title-icon">{icon}</span>}
              <h3 className="modal-title">{title}</h3>
            </div>
            {subtitle && <p className="modal-subtitle">{subtitle}</p>}
          </div>
          <button
            type="button"
            className="icon-btn modal-close-btn"
            onClick={onClose}
            aria-label="Fechar modal"
          >
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
};

export const FeedbackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextIdRef = useRef(1);

  const [confirmState, setConfirmState] = useState<{
    options: ConfirmOptions;
    resolve: (val: boolean) => void;
  } | null>(null);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (type: ToastType, message: string) => {
      const id = nextIdRef.current++;
      setToasts((prev) => [...prev, { id, type, message }]);
      window.setTimeout(() => {
        removeToast(id);
      }, 4200);
    },
    [removeToast]
  );

  const toast = useRef({
    success: (msg: string) => addToast('success', msg),
    error: (msg: string) => addToast('error', msg),
    info: (msg: string) => addToast('info', msg),
  }).current;

  // Keep toast methods bound to latest addToast
  toast.success = (msg: string) => addToast('success', msg);
  toast.error = (msg: string) => addToast('error', msg);
  toast.info = (msg: string) => addToast('info', msg);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({ options, resolve });
    });
  }, []);

  const handleConfirmClose = (accepted: boolean) => {
    if (!confirmState) return;
    const { resolve } = confirmState;
    setConfirmState(null);
    resolve(accepted);
  };

  return (
    <FeedbackContext.Provider value={{ toast, confirm }}>
      {children}

      {/* Toast Stack */}
      {toasts.length > 0 && (
        <div className="toast-container" role="region" aria-label="Notificações" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`toast-item toast-${t.type}`}>
              <span className="toast-icon">
                {t.type === 'success' ? (
                  <CheckCircle2 size={18} />
                ) : t.type === 'error' ? (
                  <AlertCircle size={18} />
                ) : (
                  <Info size={18} />
                )}
              </span>
              <span className="toast-message">{t.message}</span>
              <button
                type="button"
                className="toast-close-btn"
                onClick={() => removeToast(t.id)}
                aria-label="Fechar notificação"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Confirm Bottom Sheet / Modal */}
      <BottomSheetModal
        isOpen={!!confirmState}
        onClose={() => handleConfirmClose(false)}
        title={confirmState?.options.title || 'Confirmar ação'}
        icon={
          <AlertTriangle
            size={20}
            className={confirmState?.options.danger ? 'text-danger' : 'text-amber'}
          />
        }
        maxWidth={440}
        footer={
          <div className="modal-actions-row">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => handleConfirmClose(false)}
            >
              {confirmState?.options.cancelLabel || 'Cancelar'}
            </button>
            <button
              type="button"
              className={`btn ${confirmState?.options.danger ? 'btn-danger' : 'btn-primary'}`}
              onClick={() => handleConfirmClose(true)}
            >
              {confirmState?.options.confirmLabel || 'Confirmar'}
            </button>
          </div>
        }
      >
        <p className="confirm-message">{confirmState?.options.message}</p>
      </BottomSheetModal>
    </FeedbackContext.Provider>
  );
};
