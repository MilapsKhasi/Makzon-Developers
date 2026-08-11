import React, { useState, useEffect } from 'react';
import { Clock, ShieldCheck, Calendar, CheckCircle2, Zap, Sparkles, BadgeCheck } from 'lucide-react';
import { useLicense } from '../context/LicenseContext';
import { getAuthUser } from '../lib/supabase';
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
    isBackendActive,
  } = useLicense();

  const [isOpen, setIsOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string>('');

  useEffect(() => {
    getAuthUser().then(u => {
      if (u?.email) setUserEmail(u.email);
    });
  }, []);

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

  const isProf = licenseType === 'advanced' || localStorage.getItem('zenter_edition') === 'professional';

  const getEditionLabel = () => {
    if (isProf) return 'ZenterPrime Professional Edition';
    return 'ZenterPrime Standard Edition';
  };

  const getRemainingText = () => {
    if (isBackendActive) return 'Activated License';
    if (isExpired) return 'Trial Expired';
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
        className={`flex items-center space-x-1.5 py-1 px-2.5 rounded-lg text-xs font-bold transition-all border cursor-pointer select-none ${
          isBackendActive
            ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 shadow-2xs'
            : isExpired
            ? 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-transparent hover:border-slate-200 dark:hover:border-slate-700'
            : isProf
            ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border-transparent hover:border-slate-200 dark:hover:border-slate-700'
            : 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border-transparent hover:border-slate-200 dark:hover:border-slate-700'
        }`}
        title="Click to view license summary"
      >
        {isBackendActive ? (
          <BadgeCheck className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        ) : isProf ? (
          <Zap className="w-3.5 h-3.5 shrink-0 text-blue-500 fill-blue-500/20" />
        ) : (
          <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-indigo-500" />
        )}
        <span className="font-bold tracking-tight flex items-center gap-1.5">
          <span>{isProf ? 'Professional' : 'Standard'}</span>
          <span className="opacity-50">•</span>
          <span className={isBackendActive ? 'text-emerald-700 dark:text-emerald-300 font-bold' : ''}>{getRemainingText()}</span>
        </span>
      </button>

      {/* Main License Summary Modal */}
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="License Information"
        maxWidth="max-w-md"
      >
        <div className="p-6 space-y-4 text-slate-800 dark:text-slate-100">
          {/* Active Account & Edition Header Banner */}
          <div className={`p-4 rounded-xl border flex items-center space-x-3.5 ${
            isBackendActive
              ? 'bg-emerald-50/90 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800'
              : isProf
              ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-200/80 dark:border-blue-900/50'
              : 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-200/80 dark:border-indigo-900/50'
          }`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
              isBackendActive
                ? 'bg-emerald-600 text-white'
                : isProf ? 'bg-blue-600 text-white' : 'bg-indigo-600 text-white'
            }`}>
              {isBackendActive ? <BadgeCheck className="w-5 h-5" /> : <Sparkles className="w-5 h-5 fill-current" />}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                <span>ZenterPrime</span>
                <span className={`ml-1.5 ${
                  isBackendActive
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : isProf ? 'text-blue-600 dark:text-blue-400' : 'text-indigo-600 dark:text-indigo-400'
                }`}>
                  {isProf ? 'Professional' : 'Standard'} Edition
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">
                {userEmail || 'accountemail@gmail.com'}
              </p>
            </div>
          </div>

          {/* Trial / License Status Box */}
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                {isBackendActive ? 'Activated License (Genuine)' : '14-days Evaluation Trial'}
              </span>
              <span className="text-slate-700 dark:text-slate-300 font-mono font-bold">
                {isBackendActive ? 'Active (No Expiry)' : isExpired ? '0 / 14 Days Left' : `${daysRemaining} / 14 Days Left`}
              </span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isBackendActive
                    ? 'bg-emerald-500'
                    : isExpired
                    ? 'bg-rose-500 w-0'
                    : isProf
                    ? 'bg-blue-600'
                    : 'bg-indigo-600'
                }`}
                style={{
                  width: `${isBackendActive ? 100 : isExpired ? 0 : Math.min(100, Math.max(0, (daysRemaining / 14) * 100))}%`,
                }}
              />
            </div>
          </div>

          {/* Details Table */}
          <div className="bg-slate-50/50 dark:bg-slate-900/50 rounded-xl border border-slate-200/80 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            <div className="flex items-center justify-between p-3.5 sm:p-4">
              <span className="text-slate-600 dark:text-slate-300 font-medium flex items-center">
                <Sparkles className="w-4 h-4 mr-2 text-slate-400 shrink-0" />
                Active Plan / Edition
              </span>
              <span className={`font-bold px-3 py-1 rounded-lg text-xs ${
                isBackendActive
                  ? 'bg-emerald-600 text-white'
                  : isProf ? 'bg-blue-600 text-white' : 'bg-indigo-600 text-white'
              }`}>
                {isProf ? 'Professional' : 'Standard'}
              </span>
            </div>

            <div className="flex items-center justify-between p-3.5 sm:p-4">
              <span className="text-slate-600 dark:text-slate-300 font-medium flex items-center">
                <Calendar className="w-4 h-4 mr-2 text-slate-400 shrink-0" />
                Created Date
              </span>
              <span className="font-semibold text-slate-900 dark:text-white font-mono">
                {formatDateTime(createdAt)}
              </span>
            </div>

            <div className="flex items-center justify-between p-3.5 sm:p-4">
              <span className="text-slate-600 dark:text-slate-300 font-medium flex items-center">
                <Calendar className="w-4 h-4 mr-2 text-slate-400 shrink-0" />
                Expires At
              </span>
              <span className="font-semibold text-slate-900 dark:text-white font-mono">
                {isBackendActive ? 'Unlimited' : formatDateTime(expiresAt)}
              </span>
            </div>

            <div className="flex items-center justify-between p-3.5 sm:p-4">
              <span className="text-slate-600 dark:text-slate-300 font-medium flex items-center">
                <CheckCircle2 className="w-4 h-4 mr-2 text-slate-400 shrink-0" />
                Status
              </span>
              <span className="font-bold text-slate-900 dark:text-white">
                {isBackendActive ? 'Active License (Backend Activated)' : isExpired ? 'Expired' : 'Active Trial'}
              </span>
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className={`w-full py-3 rounded-xl font-bold text-sm text-white shadow-sm transition-all active:scale-[0.99] cursor-pointer ${
                isBackendActive
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : isProf
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              Got it
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default LicenseSummaryBadge;
