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
          // moss tint — skin health / positive outcome
          containerClass: 'bg-bone-50 border border-moss-500/20',
          iconClass: 'text-moss-500',
          iconBgClass: 'bg-moss-100',
          icon: <CheckCircle size={18} />,
          accentBar: 'bg-moss-500',
        };
      case 'error':
        return {
          // clay tint — primary alert accent
          containerClass: 'bg-bone-50 border border-clay-500/20',
          iconClass: 'text-clay-500',
          iconBgClass: 'bg-amber-100',
          icon: <XCircle size={18} />,
          accentBar: 'bg-clay-500',
        };
      case 'warning':
        return {
          // amber tint — caution
          containerClass: 'bg-bone-50 border border-amber-500/20',
          iconClass: 'text-amber-500',
          iconBgClass: 'bg-amber-100',
          icon: <AlertCircle size={18} />,
          accentBar: 'bg-amber-500',
        };
      case 'info':
        return {
          // plum tint — neutral information
          containerClass: 'bg-bone-50 border border-plum-500/20',
          iconClass: 'text-plum-500',
          iconBgClass: 'bg-plum-100',
          icon: <Info size={18} />,
          accentBar: 'bg-plum-500',
        };
    }
  };

  const styles = getToastStyles();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 480, damping: 38 }}
      className={`
        ${styles.containerClass}
        rounded-xl overflow-hidden w-full max-w-md
        flex items-stretch shadow-md
      `}
      style={{ boxShadow: '0 4px 16px -4px rgba(42,36,32,0.12)' }}
    >
      {/* Left accent bar — 3px wide, full height */}
      <div className={`w-[3px] flex-shrink-0 ${styles.accentBar}`} />

      {/* Content */}
      <div className="flex items-start gap-3 px-4 py-3.5 flex-1 min-w-0">
        <div className={`${styles.iconBgClass} rounded-full p-1.5 flex-shrink-0 mt-0.5`}>
          <span className={styles.iconClass}>{styles.icon}</span>
        </div>

        <p
          className="text-sm leading-relaxed whitespace-pre-line flex-1 min-w-0"
          style={{ fontFamily: 'var(--font-sans)', color: 'var(--color-ink-900)' }}
        >
          {message}
        </p>
      </div>

      {/* Close button */}
      <button
        onClick={() => onClose(id)}
        className="flex-shrink-0 px-3 flex items-center self-stretch hover:bg-ink-900/4 transition-colors rounded-r-xl"
        aria-label="Close notification"
      >
        <X size={14} style={{ color: 'var(--color-ink-500)' }} />
      </button>
    </motion.div>
  );
};

export default Toast;