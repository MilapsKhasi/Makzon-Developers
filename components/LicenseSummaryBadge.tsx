import React, { useState, useEffect } from 'react';
import { Clock, ShieldCheck, Calendar, CheckCircle2, AlertCircle, Info, Zap, User, Sparkles } from 'lucide-react';
import { useLicense } from '../context/LicenseContext';
import { getAuthUser, supabase } from '../lib/supabase';
import Modal from './Modal';
import EditionSelectionModal from './EditionSelectionModal';
import { applyEditionTheme } from '../utils/themeHelper';

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
    setDevEdition,
    refreshLicense,
  } = useLicense();

  const [isOpen, setIsOpen] = useState(false);
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [userEmail, setUserEmail] = useState<string>('');
  const [switchLoading, setSwitchLoading] = useState(false);

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
    if (isExpired) return 'Trial Expired';
    if (daysRemaining > 1) return `${daysRemaining} Days Remaining`;
    if (hoursRemaining > 1) return `${hoursRemaining} Hours Remaining`;
    return `${minutesRemaining} Mins Remaining`;
  };

  const handleSwitchEdition = async (edition: 'standard' | 'professional') => {
    setSwitchLoading(true);
    try {
      const licType = edition === 'standard' ? 'standard' : 'advanced';
      localStorage.setItem('zenter_license_type', licType);
      localStorage.setItem('zenter_edition', edition);
      applyEditionTheme(edition);

      const user = await getAuthUser();
      if (user && user.id !== 'local-user-1') {
        await supabase.from('profiles').upsert({
          id: user.id,
          license_type: licType,
          license_status: 'active'
        });
      }

      if (setDevEdition) {
        await setDevEdition(licType as any, 14);
      }
      if (refreshLicense) {
        await refreshLicense();
      }

      setShowSwitchModal(false);
    } catch (err: any) {
      console.error('Error switching edition:', err);
    } finally {
      setSwitchLoading(false);
    }
  };

  return (
    <>
      {/* License Remaining Tag beside Workspace Selection */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`flex items-center space-x-1.5 py-1 px-2 rounded-lg text-xs font-bold transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700 cursor-pointer select-none ${
          isExpired
            ? 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40'
            : isProf
            ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40'
            : 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40'
        }`}
        title="Click to view license summary"
      >
        {isProf ? (
          <Zap className="w-3.5 h-3.5 shrink-0 text-blue-500 fill-blue-500/20" />
        ) : (
          <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-indigo-500" />
        )}
        <span className="font-bold tracking-tight flex items-center gap-1.5">
          <span>{isProf ? 'Professional' : 'Standard'}</span>
          <span className="opacity-50">•</span>
          <span>{getRemainingText()}</span>
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
          {/* Active Account & Edition Header Banner */}
          <div className={`p-4 rounded-xl border flex items-start space-x-3.5 ${
            isProf
              ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-200/80 dark:border-blue-900/50'
              : 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-200/80 dark:border-indigo-900/50'
          }`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isProf ? 'bg-blue-600 text-white' : 'bg-indigo-600 text-white'
            }`}>
              {isProf ? <Zap className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                  {getEditionLabel()}
                </span>
                <span
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full shrink-0 uppercase tracking-wider ${
                    isExpired
                      ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                      : isProf
                      ? 'bg-blue-600 text-white'
                      : 'bg-indigo-600 text-white'
                  }`}
                >
                  {isProf ? 'Professional Blue' : 'Standard Violet'}
                </span>
              </div>

              {userEmail && (
                <div className="flex items-center text-xs text-slate-600 dark:text-slate-300 mt-1 gap-1">
                  <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">Account: <strong>{userEmail}</strong></span>
                </div>
              )}

              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                {isExpired
                  ? 'Your evaluation license has ended. System is in read-only mode.'
                  : isProf
                  ? 'Full Professional Trial Active. Color scheme: Professional Blue.'
                  : 'Standard Edition Trial Active. Color scheme: Standard Violet.'}
              </p>
            </div>
          </div>

          {/* Trial Progress Bar */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-800 dark:text-slate-200 flex items-center font-bold">
                <Clock className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                14-Day Evaluation Trial
              </span>
              <span className="text-slate-800 dark:text-slate-200 font-bold font-mono">
                {isExpired ? '0 / 14 Days Remaining' : `${daysRemaining} / 14 Days Left`}
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isExpired
                    ? 'bg-rose-500 w-0'
                    : isProf
                    ? 'bg-blue-600'
                    : 'bg-indigo-600'
                }`}
                style={{
                  width: `${isExpired ? 0 : Math.min(100, Math.max(0, (daysRemaining / 14) * 100))}%`,
                }}
              />
            </div>
          </div>

          {/* Details Table */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            <div className="flex items-center justify-between p-3.5">
              <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center">
                <Sparkles className="w-3.5 h-3.5 mr-2 text-slate-400" />
                Active Plan / Edition
              </span>
              <span className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                isProf ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' : 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
              }`}>
                {getEditionLabel()}
              </span>
            </div>

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
                License Status
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200 capitalize">
                {isExpired ? 'Read Only Mode' : 'Active Trial'}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setShowSwitchModal(true);
              }}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-primary font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Change Edition</span>
            </button>

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

      <EditionSelectionModal
        isOpen={showSwitchModal}
        onClose={() => setShowSwitchModal(false)}
        onSelect={handleSwitchEdition}
        loading={switchLoading}
      />
    </>
  );
};

export default LicenseSummaryBadge;
