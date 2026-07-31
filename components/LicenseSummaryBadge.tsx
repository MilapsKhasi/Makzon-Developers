import React, { useState } from 'react';
import { Clock, ShieldCheck, Calendar, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { useLicense } from '../context/LicenseContext';
import Modal from './Modal';

export const LicenseSummaryBadge: React.FC = () => {
  const {
    createdAt,
    expiresAt,
    licenseType,
    daysRemaining,
    hoursRemaining,
    minutesRemaining,
    isExpired,
    devMode,
  } = useLicense();

  const [isOpen, setIsOpen] = useState(false);

  // In Developer Mode (is_developer = YES), remove the 14 days remaining tag
  if (devMode) {
    return null;
  }

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return 'N/A';
    }
  };

  const getEditionLabel = () => {
    if (licenseType === 'standard') return 'Standard Edition';
    if (licenseType === 'advanced') return 'Advanced Edition';
    return 'Evaluation Edition';
  };

  const getRemainingText = () => {
    if (isExpired) return 'Trial Expired';
    if (licenseType !== 'evaluation') return 'Active Subscription';
    if (daysRemaining > 1) return `${daysRemaining} Days Remaining`;
    if (hoursRemaining > 1) return `${hoursRemaining} Hours Remaining`;
    return `${minutesRemaining} Mins Remaining`;
  };

  return (
    <>
      {/* License Remaining Tag beside Workspace Selection */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`flex items-center space-x-1.5 py-1 px-1 text-xs font-bold transition-all bg-transparent border-0 hover:opacity-80 cursor-pointer select-none ${
          isExpired
            ? 'text-rose-600 dark:text-rose-400'
            : licenseType === 'standard'
            ? 'text-emerald-600 dark:text-emerald-400'
            : licenseType === 'advanced'
            ? 'text-indigo-600 dark:text-indigo-400'
            : 'text-amber-600 dark:text-amber-400'
        }`}
        title="Click to view license summary"
      >
        {licenseType === 'standard' || licenseType === 'advanced' ? (
          <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
        ) : (
          <Clock className={`w-3.5 h-3.5 shrink-0 ${isExpired ? 'text-rose-500' : 'text-amber-600 dark:text-amber-400'}`} />
        )}
        <span className="font-bold tracking-tight">
          {getRemainingText()}
        </span>
      </button>

      {/* Main License Summary Modal */}
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="License Information"
        maxWidth="max-w-md"
      >
        <div className="p-6 space-y-5 text-slate-800 dark:text-slate-100">
          {/* Header Card */}
          <div className="flex items-center space-x-3.5 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700">
            {isExpired ? (
              <AlertCircle className="w-8 h-8 text-rose-500 shrink-0" />
            ) : licenseType === 'evaluation' ? (
              <Clock className="w-8 h-8 text-amber-500 shrink-0" />
            ) : (
              <ShieldCheck className="w-8 h-8 text-emerald-500 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-900 dark:text-white">
                  {getEditionLabel()}
                </span>
                <span
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                    isExpired
                      ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                      : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {isExpired ? 'Expired (Read Only)' : 'Active'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {isExpired
                  ? 'Your evaluation license has ended. System is in read-only mode.'
                  : licenseType === 'evaluation'
                  ? 'Active evaluation trial account.'
                  : 'Full licensed subscription active.'}
              </p>
            </div>
          </div>

          {/* Trial Progress Bar for Evaluation Edition */}
          {licenseType === 'evaluation' && (
            <div className="p-4 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-amber-900 dark:text-amber-200 flex items-center font-bold">
                  <Clock className="w-3.5 h-3.5 mr-1.5 text-amber-600 dark:text-amber-400" />
                  14-Day Trial Period
                </span>
                <span className="text-amber-800 dark:text-amber-300 font-bold font-mono">
                  {isExpired ? '0 / 14 Days Remaining' : `${daysRemaining} / 14 Days Left`}
                </span>
              </div>
              <div className="w-full bg-amber-200/70 dark:bg-amber-900/50 h-2.5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isExpired
                      ? 'bg-rose-500 w-0'
                      : daysRemaining <= 3
                      ? 'bg-rose-500'
                      : daysRemaining <= 7
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{
                    width: `${isExpired ? 0 : Math.min(100, Math.max(0, (daysRemaining / 14) * 100))}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-amber-700/80 dark:text-amber-400/80 pt-0.5">
                <span>Start (Day 1)</span>
                <span>{Math.round(Math.min(100, Math.max(0, (daysRemaining / 14) * 100)))}% Remaining</span>
                <span>14 Days Total</span>
              </div>
            </div>
          )}

          {/* Details Table / Grid */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            <div className="flex items-center justify-between p-3.5">
              <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center">
                <Calendar className="w-3.5 h-3.5 mr-2 text-slate-400" />
                Created Date
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                {formatDateTime(createdAt)}
              </span>
            </div>

            <div className="flex items-center justify-between p-3.5">
              <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center">
                <Clock className="w-3.5 h-3.5 mr-2 text-slate-400" />
                Expiration Date
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                {formatDateTime(expiresAt)}
              </span>
            </div>

            <div className="flex items-center justify-between p-3.5">
              <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center">
                <Info className="w-3.5 h-3.5 mr-2 text-slate-400" />
                Current Remaining
              </span>
              <span
                className={`font-bold ${
                  isExpired
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-amber-600 dark:text-amber-400'
                }`}
              >
                {isExpired
                  ? '0 Days (Expired)'
                  : daysRemaining > 0
                  ? `${daysRemaining} ${daysRemaining === 1 ? 'Day' : 'Days'} (${hoursRemaining % 24} hrs)`
                  : hoursRemaining > 0
                  ? `${hoursRemaining} ${hoursRemaining === 1 ? 'Hour' : 'Hours'} (${minutesRemaining % 60} mins)`
                  : `${minutesRemaining} ${minutesRemaining === 1 ? 'Minute' : 'Minutes'}`}
              </span>
            </div>

            <div className="flex items-center justify-between p-3.5">
              <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center">
                <CheckCircle2 className="w-3.5 h-3.5 mr-2 text-slate-400" />
                Status
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200 capitalize">
                {isExpired ? 'Read Only Mode' : 'Active'}
              </span>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default LicenseSummaryBadge;
