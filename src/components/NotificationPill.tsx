import React, { useEffect } from 'react';
import { Undo2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface NotificationPillProps {
  message: string;
  onUndo?: () => void;
  isVisible: boolean;
  onClose: () => void;
}

export default function NotificationPill({ message, onUndo, isVisible, onClose }: NotificationPillProps) {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onClose();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: -20, x: '-50%' }}
          className="fixed top-4 left-1/2 z-[100] flex items-center space-x-3 px-4 py-2 bg-[var(--accent)] text-black rounded-full shadow-lg font-bold text-sm"
        >
          <span>{message}</span>
          {onUndo && (
            <button onClick={onUndo} className="p-1 hover:bg-black/10 rounded-full transition-colors">
              <Undo2 size={16} />
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
