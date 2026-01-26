import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  onClose: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ id, message, type, onClose }) => {
  const getToastStyles = () => {
    switch (type) {
      case 'success':
        return {
          bg: 'bg-gradient-to-r from-green-50 to-emerald-50',
          border: 'border-green-200',
          icon: <CheckCircle className="text-green-600" size={20} />,
          iconBg: 'bg-green-100',
        };
      case 'error':
        return {
          bg: 'bg-gradient-to-r from-red-50 to-rose-50',
          border: 'border-red-200',
          icon: <XCircle className="text-red-600" size={20} />,
          iconBg: 'bg-red-100',
        };
      case 'warning':
        return {
          bg: 'bg-gradient-to-r from-amber-50 to-orange-50',
          border: 'border-amber-200',
          icon: <AlertCircle className="text-amber-600" size={20} />,
          iconBg: 'bg-amber-100',
        };
      case 'info':
        return {
          bg: 'bg-gradient-to-r from-blue-50 to-sky-50',
          border: 'border-blue-200',
          icon: <Info className="text-blue-600" size={20} />,
          iconBg: 'bg-blue-100',
        };
    }
  };

  const styles = getToastStyles();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -50, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 500, damping: 40 }}
      className={`
        ${styles.bg} ${styles.border}
        border-2 rounded-2xl p-4 shadow-lg
        backdrop-blur-sm w-full max-w-md
        flex items-start gap-3
      `}
    >
      <div className={`${styles.iconBg} rounded-full p-2 flex-shrink-0`}>
        {styles.icon}
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 leading-relaxed whitespace-pre-line">
          {message}
        </p>
      </div>

      <button
        onClick={() => onClose(id)}
        className="flex-shrink-0 p-1 rounded-full hover:bg-gray-200/50 transition-colors"
        aria-label="Close notification"
      >
        <X size={16} className="text-gray-500" />
      </button>
    </motion.div>
  );
};

export default Toast;