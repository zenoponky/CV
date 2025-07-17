import React, { createContext, useContext, useState, ReactNode } from 'react';
import ToastNotification, { ToastType } from '../components/ToastNotification';

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  hideToast: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface ToastState {
  message: string;
  type: ToastType;
  isVisible: boolean;
  duration: number;
}

interface ToastProviderProps {
  children: ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toast, setToast] = useState<ToastState>({
    message: '',
    type: 'info',
    isVisible: false,
    duration: 5000,
  });

  const showToast = (message: string, type: ToastType = 'info', duration: number = 5000) => {
    setToast({
      message,
      type,
      isVisible: true,
      duration,
    });
  };

  const hideToast = () => {
    setToast(prev => ({
      ...prev,
      isVisible: false,
    }));
  };

  const value: ToastContextType = {
    showToast,
    hideToast,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastNotification
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
        duration={toast.duration}
      />
    </ToastContext.Provider>
  );
};