import React, { useState, useEffect } from 'react';
import { X, Gift, Zap, Shield, Layout } from 'lucide-react';

const CURRENT_VERSION = 'v7.4.0';
const STORAGE_KEY = `version_popup_shown_${CURRENT_VERSION}`;

const UpdateNotification = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const hasShown = localStorage.getItem(STORAGE_KEY);
    if (!hasShown) {
      // Small delay to not overwhelm user immediately upon login/load
      const timer = setTimeout(() => setIsOpen(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={handleClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800">
        <div className="relative h-28 bg-[#312e81] overflow-hidden flex items-center justify-center">
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
            <Gift className="w-12 h-12 text-white" />
            <button 
                onClick={handleClose}
                className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors cursor-pointer"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
        
        <div className="p-6">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">ZenterPrime v7.4.0 (Early Access)</h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">New Release</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Explore the powerful security, reporting overhaul, and data mobility features in v7.4.0.</p>
            
            <div className="space-y-3 mb-6 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                <div className="flex items-start space-x-2.5">
                    <div className="p-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg shrink-0"><Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" /></div>
                    <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">Flagship Security — Z-PIN & Auth Redesign</h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Modern login/signup with 4-digit Z-PIN & device-bound IndexedDB key verification.</p>
                    </div>
                </div>
                <div className="flex items-start space-x-2.5">
                    <div className="p-1.5 bg-purple-50 dark:bg-purple-900/20 rounded-lg shrink-0"><Layout className="w-4 h-4 text-purple-600 dark:text-purple-400" /></div>
                    <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">Dashboard & UI Updates</h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Interactive visual charts on dashboard and top-right navigation settings remapping.</p>
                    </div>
                </div>
                <div className="flex items-start space-x-2.5">
                    <div className="p-1.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg shrink-0"><Zap className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /></div>
                    <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">Reports Overhaul & Styled Excel Exports</h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Modern report views with ExcelJS v4.4.0 corporate styled spreadsheets.</p>
                    </div>
                </div>
                <div className="flex items-start space-x-2.5">
                    <div className="p-1.5 bg-amber-50 dark:bg-amber-900/20 rounded-lg shrink-0"><Shield className="w-4 h-4 text-amber-600 dark:text-amber-400" /></div>
                    <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">Data Mobility & Full Excel Importer</h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Universal Export Data in CSV/Excel/JSON and seamless import engine.</p>
                    </div>
                </div>
            </div>

            <button 
                onClick={handleClose}
                className="w-full py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all active:scale-95"
            >
                Explore Now
            </button>
        </div>
      </div>
    </div>
  );
};

export default UpdateNotification;
