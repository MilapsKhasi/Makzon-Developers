import React, { useState, useEffect } from 'react';
import { Sparkles, Check, ShieldCheck, Zap, ArrowRight, Star } from 'lucide-react';
import Modal from './Modal';
import { applyEditionTheme } from '../utils/themeHelper';

interface EditionSelectionModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onSelect: (edition: 'standard' | 'professional') => Promise<void> | void;
  loading?: boolean;
}

export const EditionSelectionModal: React.FC<EditionSelectionModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  loading = false,
}) => {
  const [selected, setSelected] = useState<'standard' | 'professional'>('professional');

  useEffect(() => {
    if (isOpen) {
      applyEditionTheme(selected);
    }
  }, [isOpen, selected]);

  if (!isOpen) return null;

  const handlePick = (edition: 'standard' | 'professional') => {
    setSelected(edition);
    applyEditionTheme(edition);
  };

  const handleConfirmSelect = async (edition: 'standard' | 'professional') => {
    handlePick(edition);
    await onSelect(edition);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose ? onClose : () => {}}
      title="ZenterPrime Trial Edition Setup"
      maxWidth="max-w-3xl"
    >
      <div className="p-6 sm:p-8 space-y-6 text-slate-800 dark:text-slate-100">
        <div className="text-center space-y-2 max-w-xl mx-auto">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-primary/10 text-primary font-semibold text-xs uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>14-Day Free Trial Onboarding</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white leading-tight">
            Select the edition you wish to continue with to start a free trial.
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Choose your preferred trial experience. Selecting <strong>Standard</strong> uses standard violet theme, while <strong>Professional</strong> unlocks advanced features and professional blue theme.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
          {/* ZenterPrime Standard Card */}
          <div
            onClick={() => handlePick('standard')}
            className={`p-6 rounded-2xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
              selected === 'standard'
                ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/30 shadow-md ring-2 ring-indigo-500/20'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  Standard Trial
                </span>
                {selected === 'standard' && (
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </span>
                )}
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                ZenterPrime Standard
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
                Core accounting & financial tools with Violet theme for single & multi-branch operations.
              </p>

              <ul className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300 mb-6">
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Sales Invoices, GST & Purchase Bills</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Customer & Vendor Master Ledgers</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Stock Management & Item Inventory</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Cashbook Registers & Payment Receipts</span>
                </li>
              </ul>
            </div>

            <button
              type="button"
              disabled={loading}
              onClick={(e) => {
                e.stopPropagation();
                handleConfirmSelect('standard');
              }}
              className="w-full py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wider border-2 border-indigo-600 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span>Continue with ZenterPrime Standard</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* ZenterPrime Professional Card */}
          <div
            onClick={() => handlePick('professional')}
            className={`p-6 rounded-2xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
              selected === 'professional'
                ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/30 shadow-md ring-2 ring-blue-500/20'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
            }`}
          >
            <div className="absolute -top-3 right-4 px-3 py-0.5 rounded-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold text-[10px] tracking-wider uppercase shadow-xs flex items-center gap-1">
              <Star className="w-3 h-3 fill-current text-amber-300" /> Recommended
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-blue-500 fill-blue-500/20" />
                  Professional Trial
                </span>
                {selected === 'professional' && (
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </span>
                )}
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                ZenterPrime Professional
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
                Advanced accounting suite with <strong>Professional Blue</strong> theme & complete enterprise features.
              </p>

              <ul className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300 mb-6">
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                  <span><strong>Everything in Standard</strong> plus advanced tools</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                  <span>Delivery Challans & Dispatch Tracking</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                  <span>Premium Notices & Additional Charges</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                  <span>Advanced Analytics, Audits & Excel Imports</span>
                </li>
              </ul>
            </div>

            <button
              type="button"
              disabled={loading}
              onClick={(e) => {
                e.stopPropagation();
                handleConfirmSelect('professional');
              }}
              className="w-full py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wider bg-blue-600 text-white hover:bg-blue-700 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
            >
              <span>Continue with ZenterPrime Professional</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default EditionSelectionModal;
