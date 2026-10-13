import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Download, Upload, FileSpreadsheet, Check, AlertTriangle, 
  RefreshCw, Loader2, Users, ShoppingCart, Package, Layers, 
  ArrowRight, ShieldAlert, CheckCircle2, Trash2, HelpCircle,
  FileText, BookOpen, Receipt, FileCheck, Info
} from 'lucide-react';
import * as XLSX from 'xlsx';
import Modal from './Modal';
import { useLicense } from '../context/LicenseContext';
import { useSecurityDemo } from '../context/SecurityDemoContext';
import { 
  parseAndValidateWorkbook, 
  executeImportBatch, 
  MultiSheetImportResult, 
  EntityParsedData, 
  EntityType 
} from '../utils/importHelper';

interface ImportExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ImportExcelModal: React.FC<ImportExcelModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess 
}) => {
  const { isReadOnly } = useLicense();
  const { verifyAction } = useSecurityDemo();

  const [file, setFile] = useState<File | null>(null);
  const [scanning, setScanning] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<MultiSheetImportResult | null>(null);
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [showErrorsOnly, setShowErrorsOnly] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      resetState();
    }
  }, [isOpen]);

  const resetState = () => {
    setFile(null);
    setScanning(false);
    setImporting(false);
    setImportResult(null);
    setActiveSheetIndex(0);
    setShowErrorsOnly(false);
    setConfirmModalOpen(false);
    setSuccessMsg('');
    setErrorMsg('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // =========================================================================
  // Download Standard Templates
  // =========================================================================
  const handleDownloadTemplate = (entityType: EntityType | 'all') => {
    const wb = XLSX.utils.book_new();

    if (entityType === 'all' || entityType === 'parties') {
      const partiesHeaders = ['Record ID', 'Party Name', 'Party Type', 'GSTIN', 'Phone Number', 'Email', 'State', 'Address', 'PAN', 'Opening Balance', 'Bank Account', 'IFSC Code', 'Bank Name'];
      const sampleParties = [{
        'Record ID': '',
        'Party Name': 'Apex Enterprises',
        'Party Type': 'Customer',
        'GSTIN': '27ABCDE1234F1Z5',
        'Phone Number': '9876543210',
        'Email': 'apex@example.com',
        'State': 'Maharashtra',
        'Address': '101 Industrial Area',
        'PAN': 'ABCDE1234F',
        'Opening Balance': 5000,
        'Bank Account': '1234567890',
        'IFSC Code': 'HDFC0001234',
        'Bank Name': 'HDFC Bank'
      }];
      const ws = XLSX.utils.json_to_sheet(sampleParties, { header: partiesHeaders });
      XLSX.utils.book_append_sheet(wb, ws, 'Parties');
    }

    if (entityType === 'all' || entityType === 'stock_items') {
      const stockHeaders = ['Record ID', 'Item Name', 'HSN / SAC', 'SKU', 'Unit', 'Category', 'Purchase Rate', 'Selling Price', 'Opening Stock', 'Tax Rate (%)', 'Description'];
      const sampleStock = [{
        'Record ID': '',
        'Item Name': 'Premium Cotton Fabric',
        'HSN / SAC': '5208',
        'SKU': 'FAB-001',
        'Unit': 'MTR',
        'Category': 'Textiles',
        'Purchase Rate': 150,
        'Selling Price': 220,
        'Opening Stock': 500,
        'Tax Rate (%)': 5,
        'Description': '100% Cotton combed yarn'
      }];
      const ws = XLSX.utils.json_to_sheet(sampleStock, { header: stockHeaders });
      XLSX.utils.book_append_sheet(wb, ws, 'Stock Items');
    }

    if (entityType === 'all' || entityType === 'sales_invoices') {
      const invHeaders = ['Record ID', 'Invoice Number', 'Date', 'Customer Name', 'Subtotal', 'Total GST', 'Round Off', 'Grand Total', 'Status', 'Description', 'Line Items JSON'];
      const sampleInv = [{
        'Record ID': '',
        'Invoice Number': 'INV-2026-001',
        'Date': new Date().toISOString().split('T')[0],
        'Customer Name': 'Apex Enterprises',
        'Subtotal': 10000,
        'Total GST': 1800,
        'Round Off': 0,
        'Grand Total': 11800,
        'Status': 'Pending',
        'Description': 'Standard supply of goods',
        'Line Items JSON': ''
      }];
      const ws = XLSX.utils.json_to_sheet(sampleInv, { header: invHeaders });
      XLSX.utils.book_append_sheet(wb, ws, 'Sales Invoices');
    }

    if (entityType === 'all' || entityType === 'purchase_bills') {
      const billHeaders = ['Record ID', 'Bill Number', 'Date', 'Vendor Name', 'Subtotal', 'Total GST', 'Round Off', 'Grand Total', 'Status', 'Description', 'Line Items JSON'];
      const sampleBill = [{
        'Record ID': '',
        'Bill Number': 'BILL-9081',
        'Date': new Date().toISOString().split('T')[0],
        'Vendor Name': 'National Mills Ltd',
        'Subtotal': 25000,
        'Total GST': 4500,
        'Round Off': 0,
        'Grand Total': 29500,
        'Status': 'Paid',
        'Description': 'Raw material purchase',
        'Line Items JSON': ''
      }];
      const ws = XLSX.utils.json_to_sheet(sampleBill, { header: billHeaders });
      XLSX.utils.book_append_sheet(wb, ws, 'Purchase Bills');
    }

    if (entityType === 'all' || entityType === 'cashbooks') {
      const cbHeaders = ['Record ID', 'Date', 'Income Total', 'Expense Total', 'Net Balance', 'Entries JSON'];
      const sampleCb = [{
        'Record ID': '',
        'Date': new Date().toISOString().split('T')[0],
        'Income Total': 15000,
        'Expense Total': 3200,
        'Net Balance': 11800,
        'Entries JSON': ''
      }];
      const ws = XLSX.utils.json_to_sheet(sampleCb, { header: cbHeaders });
      XLSX.utils.book_append_sheet(wb, ws, 'Cashbooks');
    }

    if (entityType === 'all' || entityType === 'duties_taxes') {
      const taxHeaders = ['Record ID', 'Tax Name', 'Type', 'Calculation Method', 'Rate (%)', 'Fixed Amount', 'Apply On', 'Applicable To', 'Is Default'];
      const sampleTax = [{
        'Record ID': '',
        'Tax Name': 'Freight & Packing Charges',
        'Type': 'Charge',
        'Calculation Method': 'Fixed Amount',
        'Rate (%)': 0,
        'Fixed Amount': 250,
        'Apply On': 'Subtotal',
        'Applicable To': 'Both',
        'Is Default': 'No'
      }];
      const ws = XLSX.utils.json_to_sheet(sampleTax, { header: taxHeaders });
      XLSX.utils.book_append_sheet(wb, ws, 'Duties & Taxes');
    }

    const filename = entityType === 'all' ? 'ZenterPrime_Complete_Import_Template.xlsx' : `${entityType}_template.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  // =========================================================================
  // Process Uploaded Workbook
  // =========================================================================
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setScanning(true);
    setErrorMsg('');
    setSuccessMsg('');
    setImportResult(null);

    try {
      const parsed = await parseAndValidateWorkbook(selectedFile);
      if (parsed.totalRecordsFound === 0) {
        throw new Error("No data records found in the uploaded workbook. Please ensure the file has a header and at least one data row.");
      }
      setImportResult(parsed);
      setActiveSheetIndex(0);
    } catch (err: any) {
      console.error("Parse error:", err);
      setErrorMsg(err.message || "Failed to parse workbook.");
    } finally {
      setScanning(false);
    }
  };

  // =========================================================================
  // Conflict Resolution Toggles
  // =========================================================================
  const setConflictResolution = (sheetIdx: number, rowIndex: number, resolution: 'update' | 'skip' | 'create_new') => {
    if (!importResult) return;
    const updatedSheets = [...importResult.sheets];
    const sheet = { ...updatedSheets[sheetIdx] };
    sheet.conflicts = sheet.conflicts.map(c => {
      if (c.importedRowIndex === rowIndex) {
        return { ...c, resolution };
      }
      return c;
    });
    updatedSheets[sheetIdx] = sheet;
    setImportResult({ ...importResult, sheets: updatedSheets });
  };

  const setAllConflictsInSheet = (sheetIdx: number, resolution: 'update' | 'skip' | 'create_new') => {
    if (!importResult) return;
    const updatedSheets = [...importResult.sheets];
    const sheet = { ...updatedSheets[sheetIdx] };
    sheet.conflicts = sheet.conflicts.map(c => ({ ...c, resolution }));
    updatedSheets[sheetIdx] = sheet;
    setImportResult({ ...importResult, sheets: updatedSheets });
  };

  // =========================================================================
  // Execute Import
  // =========================================================================
  const handleConfirmImport = async () => {
    if (isReadOnly) {
      setErrorMsg("Evaluation license expired. Read-only mode.");
      return;
    }
    if (!importResult || importResult.totalValid === 0) {
      setErrorMsg("No valid records to import.");
      return;
    }

    setConfirmModalOpen(false);

    verifyAction('Import Accounting Data', async () => {
      setImporting(true);
      setErrorMsg('');
      try {
        const res = await executeImportBatch(importResult.sheets);
        if (res.success || res.created > 0 || res.updated > 0) {
          setSuccessMsg(`Import successful! Created ${res.created} new records, updated ${res.updated} existing records${res.skipped > 0 ? `, skipped ${res.skipped}` : ''}.`);
          if (onSuccess) onSuccess();
        } else {
          setErrorMsg(res.errors[0] || 'Import execution failed.');
        }
      } catch (err: any) {
        setErrorMsg(`Import failed: ${err.message}`);
      } finally {
        setImporting(false);
      }
    });
  };

  const currentSheet: EntityParsedData | undefined = importResult?.sheets[activeSheetIndex];

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Import Excel / CSV Data"
        maxWidth="max-w-4xl"
      >
        <div className="p-6 space-y-5">
          {/* Top Actions: Template Download & Info */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Upload multi-sheet Excel files or individual CSVs. Record IDs and relationships are preserved.
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => handleDownloadTemplate('all')}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
                title="Download template with all sheets (Parties, Stock, Invoices, Bills, Cashbook)"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Complete Excel Template</span>
              </button>
            </div>
          </div>

          {/* Alert Banners */}
          {successMsg && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-start space-x-2 text-xs text-emerald-800 dark:text-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{successMsg}</div>
              <button onClick={() => setSuccessMsg('')} className="text-emerald-600 font-bold">✕</button>
            </div>
          )}

          {errorMsg && (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-xl flex items-start space-x-2 text-xs text-rose-800 dark:text-rose-200">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{errorMsg}</div>
              <button onClick={() => setErrorMsg('')} className="text-rose-500 font-bold">✕</button>
            </div>
          )}

          {/* File Upload Dropzone (if no file loaded or wants to change) */}
          {!importResult && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-400 bg-slate-50 dark:bg-slate-900/40 rounded-xl p-10 text-center cursor-pointer transition-all space-y-3"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-2xs">
                {scanning ? <Loader2 className="w-7 h-7 animate-spin" /> : <FileSpreadsheet className="w-7 h-7" />}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {scanning ? 'Analyzing and validating workbook...' : 'Choose or drag & drop an Excel (.xlsx) or CSV file'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Supports multi-sheet workbooks (Parties, Stock Items, Invoices, Bills, Cashbooks, Taxes) or single-sheet files
                </p>
              </div>
            </div>
          )}

          {/* Validation & Preview Engine */}
          {importResult && (
            <div className="space-y-4">
              {/* File details bar */}
              <div className="p-3 bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center space-x-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                  <strong className="text-slate-800 dark:text-slate-200 font-mono truncate max-w-xs">{importResult.fileName}</strong>
                  <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-400">
                    {importResult.sheets.length} Sheet{importResult.sheets.length > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                    ✓ {importResult.totalValid} Valid
                  </span>
                  {importResult.totalConflicts > 0 && (
                    <span className="text-amber-700 dark:text-amber-400 font-bold">
                      ⚠ {importResult.totalConflicts} Existing Matches
                    </span>
                  )}
                  {importResult.totalInvalid > 0 && (
                    <span className="text-rose-700 dark:text-rose-400 font-bold">
                      ✕ {importResult.totalInvalid} Errors
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      resetState();
                      fileInputRef.current?.click();
                    }}
                    className="text-xs text-indigo-600 hover:underline font-semibold"
                  >
                    Change File
                  </button>
                </div>
              </div>

              {/* Sheet Navigation Tabs */}
              {importResult.sheets.length > 1 && (
                <div className="flex flex-wrap gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-2">
                  {importResult.sheets.map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setActiveSheetIndex(idx);
                        setShowErrorsOnly(false);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                        activeSheetIndex === idx
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <span>{s.sheetName}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        activeSheetIndex === idx ? 'bg-emerald-700 text-white' : 'bg-slate-200 dark:bg-slate-700'
                      }`}>
                        {s.validRows.length}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Active Sheet Statistics & Controls */}
              {currentSheet && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px]">
                        Entity: {currentSheet.entityType.replace('_', ' ')}
                      </span>
                      <span className="text-slate-400">•</span>
                      <span>Total: <strong>{currentSheet.totalRows}</strong></span>
                      <span className="text-slate-400">•</span>
                      <span className="text-emerald-600 font-semibold">Valid: {currentSheet.validRows.length}</span>
                      {currentSheet.invalidRows.length > 0 && (
                        <>
                          <span className="text-slate-400">•</span>
                          <span className="text-rose-600 font-semibold">Errors: {currentSheet.invalidRows.length}</span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      {currentSheet.invalidRows.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setShowErrorsOnly(!showErrorsOnly)}
                          className={`px-2.5 py-1 rounded text-xs font-bold transition-colors ${
                            showErrorsOnly 
                              ? 'bg-rose-600 text-white' 
                              : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                          }`}
                        >
                          {showErrorsOnly ? 'Show All Rows' : `View ${currentSheet.invalidRows.length} Errors`}
                        </button>
                      )}

                      {currentSheet.conflicts.length > 0 && (
                        <div className="flex items-center space-x-1 text-xs">
                          <span className="text-slate-500 text-[11px]">Existing Matches:</span>
                          <button
                            type="button"
                            onClick={() => setAllConflictsInSheet(activeSheetIndex, 'update')}
                            className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 rounded text-[10px] font-bold"
                          >
                            Update All
                          </button>
                          <button
                            type="button"
                            onClick={() => setAllConflictsInSheet(activeSheetIndex, 'skip')}
                            className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 rounded text-[10px] font-bold"
                          >
                            Skip All
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Validation Errors Drawer */}
                  {currentSheet.invalidRows.length > 0 && showErrorsOnly && (
                    <div className="p-3.5 bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl space-y-2 max-h-48 overflow-y-auto">
                      <div className="flex items-center space-x-2 text-rose-800 dark:text-rose-200 font-bold text-xs">
                        <AlertTriangle className="w-4 h-4 text-rose-600" />
                        <span>Validation Issues Detected in {currentSheet.sheetName} ({currentSheet.invalidRows.length})</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        These rows cannot be imported due to missing required columns or data type mismatch. Valid rows will still be processed.
                      </p>
                      <ul className="space-y-1 text-xs">
                        {currentSheet.invalidRows.map((err, i) => (
                          <li key={i} className="text-rose-700 dark:text-rose-300 font-mono text-[11px]">
                            • Row {err.rowNumber}: <span className="font-bold">{err.field}</span> — {err.message}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Data Preview Table */}
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 dark:bg-slate-800/80 sticky top-0 text-slate-500 font-bold uppercase text-[10px]">
                        <tr>
                          <th className="py-2 px-3">#</th>
                          {currentSheet.entityType === 'parties' || currentSheet.entityType === 'customers' || currentSheet.entityType === 'vendors' ? (
                            <>
                              <th className="py-2 px-3">Name</th>
                              <th className="py-2 px-3">Type</th>
                              <th className="py-2 px-3">GSTIN</th>
                              <th className="py-2 px-3">Phone</th>
                              <th className="py-2 px-3 text-right">Balance</th>
                            </>
                          ) : currentSheet.entityType === 'stock_items' ? (
                            <>
                              <th className="py-2 px-3">Item Name</th>
                              <th className="py-2 px-3">HSN</th>
                              <th className="py-2 px-3">Unit</th>
                              <th className="py-2 px-3 text-right">Rate</th>
                              <th className="py-2 px-3 text-right">Stock</th>
                            </>
                          ) : currentSheet.entityType === 'sales_invoices' ? (
                            <>
                              <th className="py-2 px-3">Invoice No</th>
                              <th className="py-2 px-3">Date</th>
                              <th className="py-2 px-3">Customer</th>
                              <th className="py-2 px-3">Status</th>
                              <th className="py-2 px-3 text-right">Grand Total</th>
                            </>
                          ) : currentSheet.entityType === 'purchase_bills' ? (
                            <>
                              <th className="py-2 px-3">Bill No</th>
                              <th className="py-2 px-3">Date</th>
                              <th className="py-2 px-3">Vendor</th>
                              <th className="py-2 px-3">Status</th>
                              <th className="py-2 px-3 text-right">Grand Total</th>
                            </>
                          ) : (
                            <>
                              <th className="py-2 px-3">Date / Name</th>
                              <th className="py-2 px-3">Type</th>
                              <th className="py-2 px-3 text-right">Amount / Balance</th>
                            </>
                          )}
                          <th className="py-2 px-3 text-right">Status / Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                        {currentSheet.validRows.slice(0, 50).map((row, idx) => {
                          const conflict = currentSheet.conflicts.find(c => c.importedRowIndex === idx);

                          return (
                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                              <td className="py-2 px-3 text-slate-400 font-mono text-[10px]">{idx + 1}</td>
                              {currentSheet.entityType === 'parties' || currentSheet.entityType === 'customers' || currentSheet.entityType === 'vendors' ? (
                                <>
                                  <td className="py-2 px-3 font-semibold">{row.name}</td>
                                  <td className="py-2 px-3 capitalize text-[11px]">{row.party_type || 'Customer'}</td>
                                  <td className="py-2 px-3 font-mono text-[11px]">{row.gstin || '-'}</td>
                                  <td className="py-2 px-3">{row.phone || '-'}</td>
                                  <td className="py-2 px-3 text-right font-mono">{Number(row.balance || 0).toFixed(2)}</td>
                                </>
                              ) : currentSheet.entityType === 'stock_items' ? (
                                <>
                                  <td className="py-2 px-3 font-semibold">{row.name}</td>
                                  <td className="py-2 px-3 font-mono text-[11px]">{row.hsn || '-'}</td>
                                  <td className="py-2 px-3">{row.unit || 'PCS'}</td>
                                  <td className="py-2 px-3 text-right font-mono">{Number(row.rate || 0).toFixed(2)}</td>
                                  <td className="py-2 px-3 text-right font-mono">{row.in_stock || 0}</td>
                                </>
                              ) : currentSheet.entityType === 'sales_invoices' ? (
                                <>
                                  <td className="py-2 px-3 font-bold font-mono">{row.invoice_number}</td>
                                  <td className="py-2 px-3">{row.date}</td>
                                  <td className="py-2 px-3 font-semibold">{row.customer_name}</td>
                                  <td className="py-2 px-3">
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800">
                                      {row.status || 'Pending'}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono font-bold">{Number(row.grand_total || 0).toFixed(2)}</td>
                                </>
                              ) : currentSheet.entityType === 'purchase_bills' ? (
                                <>
                                  <td className="py-2 px-3 font-bold font-mono">{row.bill_number}</td>
                                  <td className="py-2 px-3">{row.date}</td>
                                  <td className="py-2 px-3 font-semibold">{row.vendor_name}</td>
                                  <td className="py-2 px-3">
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800">
                                      {row.status || 'Pending'}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono font-bold">{Number(row.grand_total || 0).toFixed(2)}</td>
                                </>
                              ) : (
                                <>
                                  <td className="py-2 px-3 font-semibold">{row.date || row.name}</td>
                                  <td className="py-2 px-3">{row.type || 'Cash'}</td>
                                  <td className="py-2 px-3 text-right font-mono">{Number(row.balance || row.rate || 0).toFixed(2)}</td>
                                </>
                              )}

                              <td className="py-2 px-3 text-right">
                                {conflict ? (
                                  <div className="inline-flex items-center space-x-1">
                                    <select
                                      value={conflict.resolution}
                                      onChange={(e) => setConflictResolution(activeSheetIndex, idx, e.target.value as any)}
                                      className={`text-[10px] font-bold py-0.5 px-1.5 rounded border ${
                                        conflict.resolution === 'update'
                                          ? 'border-amber-300 bg-amber-50 text-amber-800'
                                          : conflict.resolution === 'skip'
                                          ? 'border-slate-300 bg-slate-50 text-slate-500'
                                          : 'border-blue-300 bg-blue-50 text-blue-800'
                                      }`}
                                    >
                                      <option value="update">Update Existing</option>
                                      <option value="skip">Skip Record</option>
                                      <option value="create_new">Create New Copy</option>
                                    </select>
                                  </div>
                                ) : (
                                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                    ✓ New Record
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {currentSheet.validRows.length > 50 && (
                    <p className="text-[11px] text-slate-400 text-center">
                      Showing first 50 rows of {currentSheet.validRows.length}. All valid rows will be imported.
                    </p>
                  )}
                </div>
              )}

              {/* Bottom Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={resetState}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 transition-colors"
                >
                  Clear File
                </button>

                <button
                  type="button"
                  disabled={importing || importResult.totalValid === 0}
                  onClick={() => setConfirmModalOpen(true)}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center space-x-1.5 cursor-pointer"
                >
                  {importing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Importing Data...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Proceed to Import ({importResult.totalValid} Valid Records)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Explicit Confirmation Dialog (Requirement 3: Never overwrite or import without explicit confirmation) */}
      <Modal
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        title="Confirm Import Execution"
        maxWidth="max-w-md"
      >
        <div className="p-6 space-y-4">
          <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="text-center">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Import Confirmation
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              You are about to import data into your active workspace.
            </p>
          </div>

          {importResult && (
            <div className="bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Total Valid Records to Process:</span>
                <strong className="text-slate-800 dark:text-slate-200">{importResult.totalValid}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Existing Records Matched:</span>
                <strong className="text-amber-600">{importResult.totalConflicts}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Invalid Rows Omitted:</span>
                <strong className="text-rose-600">{importResult.totalInvalid}</strong>
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-400">
                Data relationships, record IDs, and invoice details will be safely preserved.
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={() => setConfirmModalOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleConfirmImport}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              Yes, Execute Import
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default ImportExcelModal;
