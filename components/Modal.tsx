
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
  maxWidth = 'max-w-7xl',
  preventBackdropClose = true
}) => {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isFull = maxWidth.includes('max-w-full');

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-0 md:p-6 lg:p-12">
      <div 
        className="absolute inset-0 bg-slate-900/40" 
        onClick={() => !preventBackdropClose && onClose()} 
      />
      <div className={`relative bg-white shadow-2xl w-full ${maxWidth} ${isFull ? 'h-full' : 'max-h-full'} flex flex-col overflow-hidden md:rounded-2xl animate-in fade-in slide-in-from-bottom-8 duration-300`}>
        {/* Header */}
        <div className="flex items-center justify-between px-10 py-7 border-b border-slate-100 bg-white shrink-0">
          <h3 className="text-2xl font-bold text-slate-900 tracking-tight">{title}</h3>
          <button
            onClick={onClose}
            className="p-2.5 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
          >
            <X className="w-7 h-7" />
          </button>
        </div>
        
        {/* Body */}
        <div className="flex-1 overflow-y-auto p-12 bg-slate-50/30">
          <div className="bg-white rounded-2xl border border-slate-200 p-12 shadow-sm min-h-full">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Modal;
