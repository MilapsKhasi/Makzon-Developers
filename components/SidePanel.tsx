
import React, { useEffect, useState, useRef } from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface SidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string;
}

const SidePanel: React.FC<SidePanelProps> = ({ isOpen, onClose, title, children, width = 'max-w-xl' }) => {
  const [showCloseWarning, setShowCloseWarning] = useState(false);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) setShowCloseWarning(false);
  }, [isOpen]);

  const handleCloseAttempt = () => {
    setShowCloseWarning(true);
  };

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (showCloseWarning) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        handleCloseAttempt();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, showCloseWarning]);

  useEffect(() => {
    if (!showCloseWarning) return;

    const handleWarningKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'y') {
        e.preventDefault();
        e.stopPropagation();
        setShowCloseWarning(false);
        onCloseRef.current();
      } else if (key === 'n' || key === 'escape') {
        e.preventDefault();
        e.stopPropagation();
        setShowCloseWarning(false);
      }
    };

    window.addEventListener('keydown', handleWarningKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleWarningKeyDown, { capture: true });
    };
  }, [showCloseWarning]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150]">
      {/* 30% Opacity Backdrop - Outside clicks disabled */}
      <div 
        className="absolute inset-0 bg-slate-900/30 backdrop-blur-[1px]" 
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }} 
      />
      <div className={`absolute top-0 right-0 h-full bg-white dark:bg-slate-900 shadow-2xl flex flex-col ${width} w-full border-l border-slate-200 dark:border-slate-800`}>
        {/* Header - Compact */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900 text-white shrink-0">
          <h3 className="text-xs font-black uppercase tracking-widest">{title}</h3>
          <button
            onClick={handleCloseAttempt}
            className="p-1 hover:bg-white/10 rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        {/* Body - High Density */}
        <div className="flex-1 overflow-y-auto bg-[#fdfdfd] dark:bg-slate-900">
          {children}
        </div>
      </div>

      {/* Confirmation Warning Dialog */}
      {showCloseWarning && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/50 rounded-xl shadow-2xl p-6 max-w-md w-full flex flex-col items-center text-center animate-in zoom-in-95 duration-150">
            <div className="p-3 bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-full mb-4">
              <AlertTriangle className="w-8 h-8" />
            </div>
            
            <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
              Confirm Close Form
            </h4>
            
            <p className="text-xs text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
              Are you sure you want to close this form? You will not be able to see the entered draft data by reopening this form.
            </p>

            <div className="flex items-center justify-center gap-3 w-full">
              <button
                type="button"
                onClick={() => setShowCloseWarning(false)}
                className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold uppercase text-[11px] tracking-wider rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>No</span>
                <span className="text-[9px] bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-500 dark:text-slate-400 font-mono">(N)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowCloseWarning(false);
                  onCloseRef.current();
                }}
                className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold uppercase text-[11px] tracking-wider rounded-lg shadow-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Yes</span>
                <span className="text-[9px] bg-rose-700 px-1.5 py-0.5 rounded text-rose-100 font-mono">(Y)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SidePanel;
