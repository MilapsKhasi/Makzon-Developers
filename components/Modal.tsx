
import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
  preventBackdropClose?: boolean;
}

const Modal: React.FC<ModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  maxWidth = 'max-w-2xl',
  preventBackdropClose = false
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      
      const handleEsc = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };
      
      window.addEventListener('keydown', handleEsc);
      return () => {
        document.body.style.overflow = 'unset';
        window.removeEventListener('keydown', handleEsc);
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
      {/* 30% Opacity Grey-Toned Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/30" 
        onClick={() => !preventBackdropClose && onClose()} 
      />
      {/* Modal Container - Flat (No Shadow), Scrollable flex structure */}
      <div className={`relative bg-white border border-slate-300 w-full ${maxWidth} flex flex-col overflow-hidden rounded-md max-h-[90vh]`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white shrink-0">
          <h3 className="text-[18px] font-normal text-slate-900">{title}</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 transition-none">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto bg-white custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
