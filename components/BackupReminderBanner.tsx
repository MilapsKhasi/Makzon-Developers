import React, { useState, useEffect } from 'react';
import { ShieldCheck, Download, X, Clock, CheckCircle2 } from 'lucide-react';
import { useCompany } from '../context/CompanyContext';
import { createFullWorkspaceBackup, downloadBackupPackage } from '../utils/backupRestoreHelper';
import { supabase } from '../lib/supabase';

export const BackupReminderBanner: React.FC = () => {
  const { activeCompany } = useCompany();
  const [visible, setVisible] = useState(false);
  const [daysSince, setDaysSince] = useState<number | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  useEffect(() => {
    checkBackupReminder();
    const handleBackupCompleted = () => {
      setVisible(false);
    };
    window.addEventListener('backupCompleted', handleBackupCompleted);
    return () => window.removeEventListener('backupCompleted', handleBackupCompleted);
  }, [activeCompany?.id]);

  const checkBackupReminder = async () => {
    const cid = activeCompany?.id;
    if (!cid) {
      setVisible(false);
      return;
    }

    // 1. Check if snoozed recently (within last 3 days)
    const snoozeKey = `backup_reminder_snooze_${cid}`;
    const snoozedAt = localStorage.getItem(snoozeKey);
    if (snoozedAt) {
      const daysSinceSnooze = (Date.now() - new Date(snoozedAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceSnooze < 3) {
        setVisible(false);
        return;
      }
    }

    // 2. Check if user actually has transactions / data in this workspace
    try {
      const [{ count: custCount }, { count: invCount }] = await Promise.all([
        supabase.from('customers').select('*', { count: 'exact', head: true }).eq('company_id', cid).eq('is_deleted', false),
        supabase.from('sales_invoices').select('*', { count: 'exact', head: true }).eq('company_id', cid).eq('is_deleted', false)
      ]);
      const total = (custCount || 0) + (invCount || 0);
      if (total === 0) {
        // Workspace is empty, no need to remind yet
        setVisible(false);
        return;
      }
    } catch (_) {
      // Continue check
    }

    // 3. Check last backup date
    const backupKey = `last_backup_${cid}`;
    const lastBackupStr = localStorage.getItem(backupKey);

    if (!lastBackupStr) {
      // Never backed up
      setDaysSince(null);
      setVisible(true);
      return;
    }

    const days = Math.floor((Date.now() - new Date(lastBackupStr).getTime()) / (1000 * 60 * 60 * 24));
    if (days >= 7) {
      setDaysSince(days);
      setVisible(true);
    } else {
      setVisible(false);
    }
  };

  const handle1ClickBackup = async () => {
    const cid = activeCompany?.id;
    if (!cid) return;

    setDownloading(true);
    try {
      const backup = await createFullWorkspaceBackup(cid);
      downloadBackupPackage(backup);
      setDownloadSuccess(true);
      setTimeout(() => {
        setVisible(false);
      }, 2500);
    } catch (err) {
      console.error('Backup reminder download error:', err);
    } finally {
      setDownloading(false);
    }
  };

  const handleSnooze = () => {
    const cid = activeCompany?.id;
    if (cid) {
      localStorage.setItem(`backup_reminder_snooze_${cid}`, new Date().toISOString());
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 text-white text-xs px-4 py-2 flex flex-wrap items-center justify-between gap-3 border-b border-indigo-800 shadow-xs transition-all z-20">
      <div className="flex items-center space-x-2.5 min-w-0">
        <div className="w-6 h-6 rounded-md bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center shrink-0 text-indigo-300">
          <ShieldCheck className="w-3.5 h-3.5" />
        </div>
        <p className="font-medium text-slate-200 truncate">
          {downloadSuccess ? (
            <span className="text-emerald-300 font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> Full system backup downloaded successfully!
            </span>
          ) : daysSince !== null ? (
            <>
              Data Safety Reminder: It's been <strong className="text-white font-bold">{daysSince} days</strong> since your last workspace backup.
            </>
          ) : (
            <>
              Data Safety Reminder: Keeping a recent backup ensures you never lose accounting data.
            </>
          )}
        </p>
      </div>

      {!downloadSuccess && (
        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={handle1ClickBackup}
            disabled={downloading}
            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded font-bold text-[11px] shadow-2xs transition-colors flex items-center space-x-1 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3 h-3" />
            <span>{downloading ? 'Backing up...' : 'Backup Now (1-Click)'}</span>
          </button>
          <button
            onClick={handleSnooze}
            className="px-2.5 py-1 text-slate-300 hover:text-white hover:bg-indigo-800/60 rounded text-[11px] transition-colors flex items-center space-x-1 cursor-pointer"
            title="Remind me again in 3 days"
          >
            <Clock className="w-3 h-3" />
            <span className="hidden sm:inline">Remind in 3 Days</span>
          </button>
          <button
            onClick={handleSnooze}
            className="p-1 text-slate-400 hover:text-white rounded transition-colors cursor-pointer"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
