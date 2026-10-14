import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, FileText, Code2, CheckCircle2, Loader2, 
  ShieldCheck, HardDrive, ArrowRight, Upload
} from 'lucide-react';
import Modal from './Modal';
import { supabase } from '../lib/supabase';
import { getActiveCompanyId } from '../utils/helpers';
import { useCompany } from '../context/CompanyContext';
import { 
  exportComprehensiveWorkbook, 
  exportZipOfCsvFiles, 
  ComprehensiveExportData 
} from '../utils/exportHelper';
import { 
  createFullWorkspaceBackup, 
  downloadBackupPackage 
} from '../utils/backupRestoreHelper';
import { BackupRestoreModal } from './BackupRestoreModal';

interface ExportDataModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExportDataModal: React.FC<ExportDataModalProps> = ({ isOpen, onClose }) => {
  const { activeCompany } = useCompany();
  const [loading, setLoading] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);

  // Workspace entity state
  const [customers, setCustomers] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [parties, setParties] = useState<any[]>([]);
  const [stockItems, setStockItems] = useState<any[]>([]);
  const [salesInvoices, setSalesInvoices] = useState<any[]>([]);
  const [purchaseBills, setPurchaseBills] = useState<any[]>([]);
  const [cashbooks, setCashbooks] = useState<any[]>([]);
  const [dutiesTaxes, setDutiesTaxes] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      setSuccessMessage('');
      setExportingFormat(null);
      fetchWorkspaceData();
    }
  }, [isOpen]);

  const fetchWorkspaceData = async () => {
    setLoading(true);
    const cid = getActiveCompanyId();
    if (!cid) {
      setLoading(false);
      return;
    }

    try {
      const [
        { data: vendorRows },
        { data: customerRows },
        { data: itemRows },
        { data: invoiceRows },
        { data: billRows },
        { data: cashbookRows },
        { data: taxRows }
      ] = await Promise.all([
        supabase.from('vendors').select('*').eq('company_id', cid).eq('is_deleted', false).order('name'),
        supabase.from('customers').select('*').eq('company_id', cid).eq('is_deleted', false).order('name'),
        supabase.from('stock_items').select('*').eq('company_id', cid).eq('is_deleted', false).order('name'),
        supabase.from('sales_invoices').select('*').eq('company_id', cid).eq('is_deleted', false).order('date', { ascending: false }),
        supabase.from('purchase_bills').select('*').eq('company_id', cid).eq('is_deleted', false).order('date', { ascending: false }),
        supabase.from('cashbooks').select('*').eq('company_id', cid).eq('is_deleted', false).order('date', { ascending: false }),
        supabase.from('duties_taxes').select('*').eq('company_id', cid).eq('is_deleted', false).order('name')
      ]);

      const allCust: any[] = customerRows || [];
      const allVend: any[] = vendorRows || [];
      
      // Combine parties for unified master
      const partyMap = new Map<string, any>();
      allCust.forEach(c => partyMap.set(c.id, { ...c, party_type: c.party_type || 'customer', is_customer: true }));
      allVend.forEach(v => {
        if (!partyMap.has(v.id)) {
          partyMap.set(v.id, { ...v, party_type: v.party_type || 'vendor', is_customer: v.is_customer ?? false });
        } else {
          // If in both, mark party_type = both
          const existing = partyMap.get(v.id);
          partyMap.set(v.id, { ...existing, party_type: 'both' });
        }
      });

      setCustomers(allCust);
      setVendors(allVend);
      setParties(Array.from(partyMap.values()));
      setStockItems(itemRows || []);
      setSalesInvoices(invoiceRows || []);
      setPurchaseBills(billRows || []);
      setCashbooks(cashbookRows || []);
      setDutiesTaxes(taxRows || []);
    } catch (err) {
      console.error('Error fetching data for export:', err);
    } finally {
      setLoading(false);
    }
  };

  const getCompanySlug = () => {
    const raw = activeCompany?.name || 'Workspace';
    return raw.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').toLowerCase();
  };

  const getDateSlug = () => {
    return new Date().toISOString().split('T')[0];
  };

  const prepareExportData = (): ComprehensiveExportData => ({
    companyName: activeCompany?.name || 'Workspace',
    gstin: activeCompany?.gstin || '',
    address: activeCompany?.address || '',
    customers,
    vendors,
    parties,
    stockItems,
    salesInvoices,
    purchaseBills,
    cashbooks,
    dutiesTaxes
  });

  // 1. Export Excel File (.xlsx)
  const handleExportExcel = async () => {
    try {
      setExportingFormat('excel');
      setSuccessMessage('');
      const data = prepareExportData();
      const fileName = `${getCompanySlug()}_data_export_${getDateSlug()}.xlsx`;
      await exportComprehensiveWorkbook(data, fileName);
      setSuccessMessage('Excel workbook (.xlsx) with all entity sheets downloaded successfully.');
    } catch (err: any) {
      console.error('Excel export error:', err);
    } finally {
      setExportingFormat(null);
    }
  };

  // 2. Export CSV (.zip package of all CSV files)
  const handleExportCSV = async () => {
    try {
      setExportingFormat('csv');
      setSuccessMessage('');
      const data = prepareExportData();
      const zipFileName = `${getCompanySlug()}_csv_data_${getDateSlug()}.zip`;
      await exportZipOfCsvFiles(data, zipFileName);
      setSuccessMessage('All module CSVs packaged and downloaded in ZIP file successfully.');
    } catch (err: any) {
      console.error('CSV export error:', err);
    } finally {
      setExportingFormat(null);
    }
  };

  // 3. Export JSON (.json)
  const handleExportJSON = () => {
    try {
      setExportingFormat('json');
      setSuccessMessage('');
      const cid = getActiveCompanyId();
      const payload = {
        metadata: {
          export_version: '2.0',
          workspace_id: cid,
          workspace_name: activeCompany?.name || 'Workspace',
          exported_at: new Date().toISOString(),
          counts: {
            parties: parties.length,
            customers: customers.length,
            vendors: vendors.length,
            stock_items: stockItems.length,
            sales_invoices: salesInvoices.length,
            purchase_bills: purchaseBills.length,
            cashbooks: cashbooks.length,
            duties_taxes: dutiesTaxes.length
          }
        },
        parties,
        customers,
        vendors,
        stock_items: stockItems,
        sales_invoices: salesInvoices,
        purchase_bills: purchaseBills,
        cashbooks,
        duties_taxes: dutiesTaxes
      };

      const jsonStr = JSON.stringify(payload, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const fileName = `${getCompanySlug()}_data_export_${getDateSlug()}.json`;
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccessMessage('JSON data file downloaded successfully.');
    } catch (err: any) {
      console.error('JSON export error:', err);
    } finally {
      setExportingFormat(null);
    }
  };

  // 4. Create Complete Database Backup
  const handleCreateFullBackup = async () => {
    try {
      setExportingFormat('backup');
      setSuccessMessage('');
      const backup = await createFullWorkspaceBackup();
      const filename = downloadBackupPackage(backup);
      setSuccessMessage(`Full system backup (${filename}) created and downloaded successfully.`);
    } catch (err: any) {
      console.error('Backup error:', err);
    } finally {
      setExportingFormat(null);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Export Data"
        maxWidth="max-w-md"
        skipEscWarning={true}
      >
        <div className="p-5 space-y-3.5">
          {/* Success Alert Banner */}
          {successMessage && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center space-x-2 text-xs text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="font-medium">{successMessage}</span>
            </div>
          )}

          {/* Option 1: Excel File */}
          <div className="p-3.5 bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between transition-colors hover:border-slate-300 dark:hover:border-slate-700">
            <div className="flex items-center space-x-3 min-w-0 pr-2">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-200/50 dark:border-emerald-800/50">
                <FileSpreadsheet className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-100">Excel File</span>
                  <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-emerald-100/70 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    .xlsx
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  Multi-sheet workbook (Parties, Invoices, Bills, Stock, Cashbook)
                </p>
              </div>
            </div>
            <button
              onClick={handleExportExcel}
              disabled={loading || exportingFormat !== null}
              className="px-4 py-1.5 bg-primary hover:bg-primary-dark active:bg-indigo-900 disabled:opacity-50 text-white font-semibold text-xs rounded-lg transition-colors shrink-0 shadow-2xs flex items-center space-x-1.5 cursor-pointer"
            >
              {exportingFormat === 'excel' ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Exporting...</span>
                </>
              ) : (
                <span>Export</span>
              )}
            </button>
          </div>

          {/* Option 2: CSV */}
          <div className="p-3.5 bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between transition-colors hover:border-slate-300 dark:hover:border-slate-700">
            <div className="flex items-center space-x-3 min-w-0 pr-2">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-200/50 dark:border-blue-800/50">
                <FileText className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-100">CSV Files</span>
                  <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-blue-100/70 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    .csv (ZIP)
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  Package of all module tables with preserved record IDs
                </p>
              </div>
            </div>
            <button
              onClick={handleExportCSV}
              disabled={loading || exportingFormat !== null}
              className="px-4 py-1.5 bg-primary hover:bg-primary-dark active:bg-indigo-900 disabled:opacity-50 text-white font-semibold text-xs rounded-lg transition-colors shrink-0 shadow-2xs flex items-center space-x-1.5 cursor-pointer"
            >
              {exportingFormat === 'csv' ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Exporting...</span>
                </>
              ) : (
                <span>Export</span>
              )}
            </button>
          </div>

          {/* Option 3: JSON */}
          <div className="p-3.5 bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between transition-colors hover:border-slate-300 dark:hover:border-slate-700">
            <div className="flex items-center space-x-3 min-w-0 pr-2">
              <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-200/50 dark:border-amber-800/50">
                <Code2 className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-100">JSON Data</span>
                  <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-amber-100/70 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    .json
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  Structured records export for developers and custom APIs
                </p>
              </div>
            </div>
            <button
              onClick={handleExportJSON}
              disabled={loading || exportingFormat !== null}
              className="px-4 py-1.5 bg-primary hover:bg-primary-dark active:bg-indigo-900 disabled:opacity-50 text-white font-semibold text-xs rounded-lg transition-colors shrink-0 shadow-2xs flex items-center space-x-1.5 cursor-pointer"
            >
              {exportingFormat === 'json' ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Exporting...</span>
                </>
              ) : (
                <span>Export</span>
              )}
            </button>
          </div>

          {/* System Backup & Restore Section */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Full System Backup & Restore
                  </span>
                </div>
                <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">
                  Disaster Recovery
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                Ordinary Excel exports are for spreadsheets and re-import. Full system backup creates an immutable, 100% restorable replica of your entire workspace database.
              </p>
              <div className="flex items-center space-x-2 pt-1">
                <button
                  type="button"
                  onClick={handleCreateFullBackup}
                  disabled={loading || exportingFormat !== null}
                  className="flex-1 py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  <HardDrive className="w-3.5 h-3.5" />
                  <span>{exportingFormat === 'backup' ? 'Creating Backup...' : 'Create Backup (.xlsx)'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsRestoreModalOpen(true)}
                  className="py-1.5 px-3 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold rounded-lg shadow-2xs transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Restore Backup...</span>
                </button>
              </div>
            </div>
          </div>

          {/* Records summary footer */}
          <div className="pt-1 text-[11px] text-slate-400 text-center flex items-center justify-center space-x-3">
            <span>Parties: <strong className="text-slate-600 dark:text-slate-300">{parties.length}</strong></span>
            <span>•</span>
            <span>Items: <strong className="text-slate-600 dark:text-slate-300">{stockItems.length}</strong></span>
            <span>•</span>
            <span>Invoices: <strong className="text-slate-600 dark:text-slate-300">{salesInvoices.length}</strong></span>
            <span>•</span>
            <span>Bills: <strong className="text-slate-600 dark:text-slate-300">{purchaseBills.length}</strong></span>
          </div>
        </div>
      </Modal>

      {/* Backup Restore Modal */}
      <BackupRestoreModal
        isOpen={isRestoreModalOpen}
        onClose={() => setIsRestoreModalOpen(false)}
        onSuccess={() => {
          setIsRestoreModalOpen(false);
          fetchWorkspaceData();
        }}
      />
    </>
  );
};

export default ExportDataModal;
