import React, { useState, useRef } from 'react';
import { 
  Upload, HardDrive, AlertTriangle, CheckCircle2, Loader2, 
  FileSpreadsheet, FileJson, ShieldAlert, ArrowRight, Database
} from 'lucide-react';
import Modal from './Modal';
import { useLicense } from '../context/LicenseContext';
import { useCompany } from '../context/CompanyContext';
import { useSecurityDemo } from '../context/SecurityDemoContext';
import { 
  validateBackupFile, 
  restoreWorkspaceBackup, 
  ValidationBackupResult, 
  RestoreResult 
} from '../utils/backupRestoreHelper';

interface BackupRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const BackupRestoreModal: React.FC<BackupRestoreModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess 
}) => {
  const { isReadOnly } = useLicense();
  const { activeCompany } = useCompany();
  const { verifyAction } = useSecurityDemo();

  const [file, setFile] = useState<File | null>(null);
  const [validating, setValidating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationBackupResult | null>(null);
  const [restoreMode, setRestoreMode] = useState<'merge' | 'replace'>('merge');
  const [confirmText, setConfirmText] = useState('');
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setFile(null);
    setValidating(false);
    setRestoring(false);
    setValidationResult(null);
    setRestoreMode('merge');
    setConfirmText('');
    setRestoreResult(null);
    setErrorMsg('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setValidating(true);
    setErrorMsg('');
    setValidationResult(null);
    setRestoreResult(null);

    try {
      const isExcel = selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls');
      let val: ValidationBackupResult;
      
      if (isExcel) {
        const buffer = await selectedFile.arrayBuffer();
        val = validateBackupFile(buffer, selectedFile.name);
      } else {
        const text = await selectedFile.text();
        val = validateBackupFile(text, selectedFile.name);
      }

      setValidationResult(val);
      if (!val.isValid) {
        setErrorMsg(val.error || 'Invalid backup file.');
      }
    } catch (err: any) {
      setErrorMsg(`Failed to read file: ${err.message}`);
    } finally {
      setValidating(false);
    }
  };

  const handleExecuteRestore = async () => {
    if (isReadOnly) {
      setErrorMsg('Cannot restore in read-only mode.');
      return;
    }
    if (!validationResult?.isValid || !validationResult.packageData) {
      setErrorMsg('Please select a valid backup package.');
      return;
    }
    if (restoreMode === 'replace' && confirmText.trim().toUpperCase() !== 'RESTORE') {
      setErrorMsg('Please type RESTORE to confirm full replacement mode.');
      return;
    }

    verifyAction('Restore System Backup', async () => {
      setRestoring(true);
      setErrorMsg('');
      try {
        const res = await restoreWorkspaceBackup(
          validationResult.packageData!,
          restoreMode,
          activeCompany?.id
        );
        setRestoreResult(res);
        if (onSuccess) onSuccess();
      } catch (err: any) {
        setErrorMsg(`Restore failed: ${err.message}`);
      } finally {
        setRestoring(false);
      }
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        resetState();
        onClose();
      }}
      title="Restore Workspace Backup"
      maxWidth="max-w-xl"
    >
      <div className="p-6 space-y-5">
        {/* Success Banner */}
        {restoreResult && (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-3">
            <div className="flex items-center space-x-2 text-emerald-800 dark:text-emerald-200 font-bold text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{restoreResult.message}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
              <div className="bg-white dark:bg-slate-900 p-2 rounded border border-emerald-200/60 dark:border-emerald-900/60">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Customers</span>
                <span className="font-semibold">{restoreResult.details.customers.inserted + restoreResult.details.customers.updated} restored</span>
              </div>
              <div className="bg-white dark:bg-slate-900 p-2 rounded border border-emerald-200/60 dark:border-emerald-900/60">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Vendors</span>
                <span className="font-semibold">{restoreResult.details.vendors.inserted + restoreResult.details.vendors.updated} restored</span>
              </div>
              <div className="bg-white dark:bg-slate-900 p-2 rounded border border-emerald-200/60 dark:border-emerald-900/60">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Stock Items</span>
                <span className="font-semibold">{restoreResult.details.stock_items.inserted + restoreResult.details.stock_items.updated} restored</span>
              </div>
              <div className="bg-white dark:bg-slate-900 p-2 rounded border border-emerald-200/60 dark:border-emerald-900/60">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Invoices</span>
                <span className="font-semibold">{restoreResult.details.sales_invoices.inserted + restoreResult.details.sales_invoices.updated} restored</span>
              </div>
            </div>
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  resetState();
                  onClose();
                }}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                Close & Return
              </button>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {errorMsg && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-xl flex items-start space-x-2 text-xs text-rose-800 dark:text-rose-200">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{errorMsg}</div>
          </div>
        )}

        {!restoreResult && (
          <>
            {/* Step 1: File Upload */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                  Select Excel (.xlsx) or JSON Backup
                </label>
                <span className="text-[10px] text-slate-400">
                  Universal Restore Engine
                </span>
              </div>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 bg-slate-50 dark:bg-slate-900/40 rounded-xl p-6 text-center cursor-pointer transition-colors"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/json"
                  onChange={handleFileSelected}
                  className="hidden"
                />
                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    {file?.name?.endsWith('.xlsx') || file?.name?.endsWith('.xls') ? (
                      <FileSpreadsheet className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <FileJson className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {file ? file.name : 'Click to browse or drop your backup file'}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Accepts ZenterPrime Excel backup workbooks (.xlsx) and JSON archives
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2: Inspection and Counts */}
            {validating && (
              <div className="p-4 text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                <span>Inspecting backup schema and verifying records...</span>
              </div>
            )}

            {validationResult?.isValid && validationResult.packageData && (
              <div className="space-y-4 pt-1">
                <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200/70 dark:border-slate-800 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Backup Workspace</span>
                      <strong className="text-slate-800 dark:text-slate-200">
                        {validationResult.metadata?.companyName || 'Workspace'}
                      </strong>
                    </div>
                    <div className="text-right flex items-center space-x-2">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                        {validationResult.detectedFormat === 'excel' ? 'Excel .xlsx' : 'JSON Archive'}
                      </span>
                      <span className="font-mono text-slate-600 dark:text-slate-300">
                        {validationResult.metadata?.createdAt?.slice(0, 10) || 'N/A'}
                      </span>
                    </div>
                  </div>

                  {/* Entity Counts Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800">
                      <span className="text-slate-400 text-[10px] font-bold uppercase block">Customers</span>
                      <strong className="text-slate-800 dark:text-slate-200 text-sm">{validationResult.counts?.customers || 0}</strong>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800">
                      <span className="text-slate-400 text-[10px] font-bold uppercase block">Vendors</span>
                      <strong className="text-slate-800 dark:text-slate-200 text-sm">{validationResult.counts?.vendors || 0}</strong>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800">
                      <span className="text-slate-400 text-[10px] font-bold uppercase block">Stock Items</span>
                      <strong className="text-slate-800 dark:text-slate-200 text-sm">{validationResult.counts?.stock_items || 0}</strong>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800">
                      <span className="text-slate-400 text-[10px] font-bold uppercase block">Invoices</span>
                      <strong className="text-slate-800 dark:text-slate-200 text-sm">{validationResult.counts?.sales_invoices || 0}</strong>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800">
                      <span className="text-slate-400 text-[10px] font-bold uppercase block">Bills</span>
                      <strong className="text-slate-800 dark:text-slate-200 text-sm">{validationResult.counts?.purchase_bills || 0}</strong>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800">
                      <span className="text-slate-400 text-[10px] font-bold uppercase block">Cashbooks</span>
                      <strong className="text-slate-800 dark:text-slate-200 text-sm">{validationResult.counts?.cashbooks || 0}</strong>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800">
                      <span className="text-slate-400 text-[10px] font-bold uppercase block">Duties/Taxes</span>
                      <strong className="text-slate-800 dark:text-slate-200 text-sm">{validationResult.counts?.duties_taxes || 0}</strong>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800">
                      <span className="text-slate-400 text-[10px] font-bold uppercase block">Total Records</span>
                      <strong className="text-indigo-600 dark:text-indigo-400 text-sm">
                        {Object.values(validationResult.counts || {}).reduce((a, b) => a + b, 0)}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Step 3: Restore Mode Selection */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                    Restore Strategy
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setRestoreMode('merge')}
                      className={`p-3 text-left rounded-xl border text-xs cursor-pointer transition-all ${
                        restoreMode === 'merge'
                          ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 ring-1 ring-indigo-500'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                        <span>Merge & Update</span>
                        {restoreMode === 'merge' && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        Updates records by ID and inserts new entries. Preserves records not present in backup.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRestoreMode('replace')}
                      className={`p-3 text-left rounded-xl border text-xs cursor-pointer transition-all ${
                        restoreMode === 'replace'
                          ? 'border-rose-600 bg-rose-50/50 dark:bg-rose-950/40 ring-1 ring-rose-500'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="font-bold text-rose-700 dark:text-rose-300 flex items-center space-x-1.5">
                        <span>Clean Replacement</span>
                        {restoreMode === 'replace' && <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        Replaces current active workspace data with this snapshot.
                      </p>
                    </button>
                  </div>
                </div>

                {/* Double Confirmation for Replace Mode */}
                {restoreMode === 'replace' && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl space-y-2">
                    <div className="flex items-center space-x-2 text-xs font-bold text-amber-800 dark:text-amber-200">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Type "RESTORE" to confirm complete database replacement:</span>
                    </div>
                    <input
                      type="text"
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      placeholder="Type RESTORE here"
                      className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-lg text-slate-800 dark:text-slate-200 font-mono focus:outline-none"
                    />
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={resetState}
                    className="px-4 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={restoring || (restoreMode === 'replace' && confirmText.trim().toUpperCase() !== 'RESTORE')}
                    onClick={handleExecuteRestore}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs flex items-center space-x-1.5 cursor-pointer"
                  >
                    {restoring ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Restoring Data...</span>
                      </>
                    ) : (
                      <>
                        <Database className="w-3.5 h-3.5" />
                        <span>Execute Restore ({restoreMode === 'merge' ? 'Merge' : 'Clean Replace'})</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};

export default BackupRestoreModal;
