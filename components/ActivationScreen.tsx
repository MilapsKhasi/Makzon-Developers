import React from 'react';
import { Lock, AlertTriangle, ShieldAlert } from 'lucide-react';
import { useLicense } from '../context/LicenseContext';
import Modal from './Modal';

export const ActivationScreen: React.FC = () => {
  const {
    isExpired,
    expiresAt,
    daysRemaining,
    show5DayWarning,
    dismiss5DayWarning,
  } = useLicense();

  const [isExpiredDismissed, setIsExpiredDismissed] = React.useState(false);

  const formattedExpiryDate = expiresAt
    ? new Date(expiresAt).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : 'End of Trial';

  return (
    <>
      {/* Trial Expiring Soon Modal (5 Days or less remaining) */}
      <Modal
        isOpen={show5DayWarning}
        onClose={dismiss5DayWarning}
        title="Trial Expiring Soon"
        maxWidth="max-w-md"
      >
        <div className="p-6 space-y-5 text-slate-800 dark:text-slate-100">
          <div className="flex items-center space-x-3 bg-amber-50 dark:bg-amber-950/40 p-4 rounded-xl border border-amber-200 dark:border-amber-900/60">
            <AlertTriangle className="w-8 h-8 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <h4 className="font-extrabold text-sm text-amber-900 dark:text-amber-200">
                Trial Expiring Soon
              </h4>
              <p className="text-xs text-amber-800 dark:text-amber-300 mt-1 font-medium leading-relaxed">
                Your Evaluation Edition will expire in {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'}. Upgrade to continue enjoying all ZenterPrime features without interruption.
              </p>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={dismiss5DayWarning}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-lg transition-colors"
            >
              Remind Me Later
            </button>
            <button
              type="button"
              onClick={() => {
                alert('Upgrade request received. Placeholder action.');
              }}
              className="px-5 py-2 bg-primary hover:bg-primary-dark text-white font-bold text-xs rounded-lg shadow-sm transition-colors"
            >
              Upgrade to Continue
            </button>
          </div>
        </div>
      </Modal>

      {/* Trial Expired Overlay / Modal */}
      <Modal
        isOpen={isExpired && !isExpiredDismissed}
        onClose={() => setIsExpiredDismissed(true)}
        title="Trial Expired"
        maxWidth="max-w-md"
      >
        <div className="p-6 space-y-5 text-slate-800 dark:text-slate-100">
          <div className="flex items-start space-x-3 bg-rose-50 dark:bg-rose-950/40 p-4 rounded-xl border border-rose-200 dark:border-rose-900/60">
            <ShieldAlert className="w-8 h-8 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <h4 className="font-extrabold text-sm text-rose-900 dark:text-rose-200">
                Your 14-Day Evaluation Edition expired on {formattedExpiryDate}
              </h4>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                Your workspace and business data are completely safe. Upgrade to continue working.
              </p>
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-1">
            <div className="flex items-center space-x-1.5 font-bold text-slate-800 dark:text-slate-200">
              <Lock className="w-3.5 h-3.5 text-rose-500" />
              <span>Read-Only Mode Active</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              You can view and export all existing invoices, bills, customers, vendors, and reports. Record creation and edits are temporarily disabled.
            </p>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={() => setIsExpiredDismissed(true)}
              className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-lg transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                alert('Upgrade request received. Placeholder action.');
              }}
              className="flex-1 py-2.5 bg-primary hover:bg-primary-dark text-white font-bold text-xs rounded-lg shadow-sm transition-colors text-center"
            >
              Upgrade to Continue
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default ActivationScreen;
