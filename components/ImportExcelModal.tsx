import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Download, Upload, FileSpreadsheet, Check, AlertTriangle, 
  RefreshCw, Loader2, Users, ShoppingCart, Package, Layers, 
  ArrowRight, ShieldAlert, CheckCircle2, Trash2, HelpCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import Modal from './Modal';
import { getActiveCompanyId, safeSupabaseSave, toStorageValue } from '../utils/helpers';
import { supabase } from '../lib/supabase';

interface ImportExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type TabType = 'customers' | 'vendors' | 'stock_items' | 'stock_groups';

interface ConflictItem {
  importedRow: any;
  importedRowIndex: number;
  matchingSystemEntries: any[];
  resolution: 'remap' | 'discard';
  targetSystemId?: string; // ID of the existing entry to update if remapping
}

export const ImportExcelModal: React.FC<ImportExcelModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [activeTab, setActiveTab] = useState<TabType>('customers');
  const [file, setFile] = useState<File | null>(null);
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [scanning, setScanning] = useState<boolean>(false);
  const [importSuccess, setImportSuccess] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Conflicts state
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [existingEntries, setExistingEntries] = useState<any[]>([]);

  // Track if CSV template was downloaded per tab
  const [downloadedTabs, setDownloadedTabs] = useState<Record<TabType, boolean>>({
    customers: false,
    vendors: false,
    stock_items: false,
    stock_groups: false,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when tab changes or modal opens
  useEffect(() => {
    if (isOpen) {
      resetTabState();
    }
  }, [isOpen, activeTab]);

  const resetTabState = () => {
    setFile(null);
    setParsedHeaders([]);
    setParsedRows([]);
    setConflicts([]);
    setExistingEntries([]);
    setImportSuccess(false);
    setSuccessMessage('');
    setErrorMsg('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // =========================================================================
  // STEP 1: Download Template
  // =========================================================================
  const handleDownloadTemplate = () => {
    let headers: string[] = [];
    let sampleData: string[][] = [];
    let fileName = '';

    if (activeTab === 'customers') {
      fileName = 'Customers_Import_Template.csv';
      headers = ['Customer', 'GSTIN', 'Phone', 'Email', 'State', 'Opening Balance'];
      sampleData = [];
    } else if (activeTab === 'vendors') {
      fileName = 'Vendors_Import_Template.csv';
      headers = ['Vendor', 'GSTIN', 'Phone', 'Email', 'State', 'Opening Balance'];
      sampleData = [];
    } else if (activeTab === 'stock_items') {
      fileName = 'Stock_Items_Import_Template.csv';
      headers = ['Item', 'HSN / SAC', 'Purchase Rate', 'Selling Price', 'Opening Stock'];
      sampleData = [];
    } else if (activeTab === 'stock_groups') {
      fileName = 'Stock_Groups_Import_Template.csv';
      headers = ['Group', 'Parent Group', 'Description'];
      sampleData = [];
    }

    const csvRows = [headers.join(',')];
    sampleData.forEach(row => {
      const escaped = row.map(val => `"${String(val).replace(/"/g, '""')}"`);
      csvRows.push(escaped.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Mark template as downloaded for active tab to enable upload button
    setDownloadedTabs(prev => ({ ...prev, [activeTab]: true }));
  };

  // =========================================================================
  // Fetch Existing Entries for Duplicate Check
  // =========================================================================
  const fetchExistingEntries = async (cid: string) => {
    try {
      if (activeTab === 'customers') {
        const [{ data: custs }, { data: vends }] = await Promise.all([
          supabase.from('customers').select('*').eq('company_id', cid).eq('is_deleted', false),
          supabase.from('vendors').select('*').eq('company_id', cid).eq('is_deleted', false)
        ]);
        const map = new Map();
        (custs || []).forEach((c: any) => map.set(c.id, c));
        (vends || []).filter((v: any) => v.party_type === 'customer' || v.is_customer).forEach((v: any) => map.set(v.id, v));
        return Array.from(map.values());
      } else if (activeTab === 'vendors') {
        const { data: vends } = await supabase.from('vendors').select('*').eq('company_id', cid).eq('is_deleted', false);
        return (vends || []).filter((v: any) => v.party_type === 'vendor' || !v.is_customer);
      } else if (activeTab === 'stock_items') {
        const { data: items } = await supabase.from('stock_items').select('*').eq('company_id', cid).eq('is_deleted', false);
        return items || [];
      } else if (activeTab === 'stock_groups') {
        // Try stock_groups table, fallback to stock_items categories
        const { data: groups } = await supabase.from('stock_groups').select('*').eq('company_id', cid).eq('is_deleted', false);
        if (groups && groups.length > 0) return groups;
        
        const { data: items } = await supabase.from('stock_items').select('category').eq('company_id', cid).eq('is_deleted', false);
        const uniqueCategories = Array.from(new Set((items || []).map((i: any) => i.category).filter(Boolean)));
        return uniqueCategories.map((cat, idx) => ({ id: `cat-${idx}`, name: cat }));
      }
      return [];
    } catch (err) {
      console.warn("Failed fetching existing entries for conflict detection:", err);
      return [];
    }
  };

  // Normalize string for fuzzy matching
  const cleanStr = (s: any) => String(s || '').trim().toLowerCase();

  // Dictionary of variations to canonical header names
  const canonicalHeaderMap: Record<string, string> = {
    // Customers / Vendors
    'customer name': 'Customer Name',
    'customer': 'Customer Name',
    'cust name': 'Customer Name',
    'client name': 'Customer Name',
    'vendor name': 'Vendor Name',
    'vendor': 'Vendor Name',
    'supplier name': 'Vendor Name',
    'supplier': 'Vendor Name',
    
    // Identifiers & Contacts
    'gstin': 'GST Number',
    'gst': 'GST Number',
    'gst number': 'GST Number',
    'gstin uin': 'GST Number',
    'gstin/uin': 'GST Number',
    'gst no': 'GST Number',
    'gstin number': 'GST Number',
    
    'phone': 'Phone Number',
    'mobile': 'Phone Number',
    'contact': 'Phone Number',
    'phone number': 'Phone Number',
    'mobile number': 'Phone Number',
    'contact number': 'Phone Number',
    
    'email': 'Email',
    'email address': 'Email',
    'e mail': 'Email',
    
    'state': 'State',
    'state name': 'State',
    'place of supply': 'State',
    
    'opening balance': 'Opening Balance',
    'balance': 'Opening Balance',
    'opening bal': 'Opening Balance',
    'opening balance rs': 'Opening Balance',

    // Invoices / Bills
    'invoice number': 'Invoice Number',
    'invoice no': 'Invoice Number',
    'invoice': 'Invoice Number',
    'inv number': 'Invoice Number',
    'inv no': 'Invoice Number',
    'bill number': 'Invoice Number',
    'bill no': 'Invoice Number',

    // Stock Items
    'item name': 'Item Name',
    'item': 'Item Name',
    'product name': 'Item Name',
    'product': 'Item Name',
    'stock item': 'Item Name',

    'hsn sac': 'HSN / SAC',
    'hsn/sac': 'HSN / SAC',
    'hsn': 'HSN / SAC',
    'sac': 'HSN / SAC',
    'hsn code': 'HSN / SAC',

    'purchase rate': 'Purchase Rate',
    'purchase price': 'Purchase Rate',
    'cost price': 'Purchase Rate',
    'rate': 'Purchase Rate',
    'buy price': 'Purchase Rate',

    'selling price': 'Selling Price',
    'sale price': 'Selling Price',
    'selling rate': 'Selling Price',
    'sell price': 'Selling Price',
    'price': 'Selling Price',

    'opening stock': 'Opening Stock',
    'stock': 'Opening Stock',
    'opening qty': 'Opening Stock',
    'qty': 'Opening Stock',
    'quantity': 'Opening Stock',

    'group name': 'Group Name',
    'stock group': 'Group Name',
    'parent group': 'Group Name',
    'category': 'Group Name'
  };

  const normalizeHeaderString = (raw: string, currentTab?: string): string => {
    if (!raw) return '';
    // Replace separators (_ - / | + \ :) with spaces
    let cleaned = raw.replace(/[_/|+:\\-]/g, ' ');
    // Remove extra whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    const lower = cleaned.toLowerCase();

    // Context override for standalone "Name"
    if (lower === 'name') {
      if (currentTab === 'customers') return 'Customer Name';
      if (currentTab === 'vendors') return 'Vendor Name';
      if (currentTab === 'stock_items') return 'Item Name';
      if (currentTab === 'stock_groups') return 'Group Name';
    }

    if (canonicalHeaderMap[lower]) {
      return canonicalHeaderMap[lower];
    }
    
    // Alphanumeric fallback search
    const alphaOnly = lower.replace(/[^a-z0-9]/g, '');
    for (const [key, canonical] of Object.entries(canonicalHeaderMap)) {
      if (key.replace(/[^a-z0-9]/g, '') === alphaOnly) {
        return canonical;
      }
    }

    return cleaned;
  };

  // Flexible key extraction helper
  const getValue = (row: Record<string, any>, aliases: string[]): string => {
    if (!row) return '';
    // Direct check
    for (const alias of aliases) {
      if (row[alias] !== undefined && row[alias] !== null && String(row[alias]).trim() !== '') {
        return String(row[alias]).trim();
      }
    }
    // Case-insensitive & punctuation-insensitive key search
    const keys = Object.keys(row);
    for (const alias of aliases) {
      const cleanAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const key of keys) {
        const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cleanKey === cleanAlias) {
          const val = row[key];
          if (val !== undefined && val !== null && String(val).trim() !== '') {
            return String(val).trim();
          }
        }
      }
    }
    return '';
  };

  // =========================================================================
  // STEP 2: File Scanning & Parsing
  // =========================================================================
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    await processUploadedFile(selectedFile);
  };

  const processUploadedFile = async (selectedFile: File) => {
    setFile(selectedFile);
    setScanning(true);
    setErrorMsg('');
    setImportSuccess(false);

    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      const rawJson = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];
      
      if (!rawJson || rawJson.length < 2) {
        throw new Error("The uploaded file is empty or does not contain data rows.");
      }

      // Find first non-empty row as header
      let headerIdx = 0;
      for (let i = 0; i < Math.min(rawJson.length, 5); i++) {
        if (rawJson[i] && rawJson[i].some((cell: any) => String(cell).trim() !== '')) {
          headerIdx = i;
          break;
        }
      }

      // Build column mapping supporting adjacent header merging (e.g. Cell 0: "Customer", Cell 1: "Name")
      const colMappings: { indices: number[]; canonicalName: string }[] = [];
      const rawHeaderRow = rawJson[headerIdx] || [];
      const len = rawHeaderRow.length;

      let col = 0;
      while (col < len) {
        const cellVal1 = String(rawHeaderRow[col] || '').trim();
        const cellVal2 = col + 1 < len ? String(rawHeaderRow[col + 1] || '').trim() : '';

        if (!cellVal1) {
          col++;
          continue;
        }

        // Check adjacent cell combination
        if (cellVal2) {
          const combinedRaw = `${cellVal1} ${cellVal2}`;
          const normalizedCombined = normalizeHeaderString(combinedRaw, activeTab);
          const lower1 = cellVal1.toLowerCase().replace(/[^a-z0-9]/g, '');
          const lower2 = cellVal2.toLowerCase().replace(/[^a-z0-9]/g, '');

          const isKnownCanonical = Object.values(canonicalHeaderMap).includes(normalizedCombined);
          const isSuffixFragment = ['name', 'number', 'no', 'balance', 'stock', 'rate', 'price', 'sac', 'code', 'uin'].includes(lower2);
          const isPrefixKeyword = ['customer', 'vendor', 'party', 'invoice', 'gst', 'gstin', 'phone', 'mobile', 'item', 'product', 'group', 'opening', 'purchase', 'selling', 'hsn'].includes(lower1);

          if (isKnownCanonical || (isPrefixKeyword && isSuffixFragment)) {
            colMappings.push({
              indices: [col, col + 1],
              canonicalName: normalizedCombined
            });
            col += 2;
            continue;
          }
        }

        // Single column header
        const normalizedSingle = normalizeHeaderString(cellVal1, activeTab);
        colMappings.push({
          indices: [col],
          canonicalName: normalizedSingle
        });
        col++;
      }

      const headers = colMappings.map(m => m.canonicalName);

      if (headers.length === 0) {
        throw new Error("Could not detect valid column headers in the uploaded file.");
      }

      const dataRows: any[] = [];
      for (let i = headerIdx + 1; i < rawJson.length; i++) {
        const row = rawJson[i];
        if (!row || row.every((cell: any) => cell === '' || cell === null || cell === undefined)) continue;
        
        const rowObj: Record<string, any> = {};
        colMappings.forEach(mapping => {
          const values = mapping.indices
            .map(idx => (row[idx] !== undefined && row[idx] !== null ? String(row[idx]).trim() : ''))
            .filter(Boolean);
          rowObj[mapping.canonicalName] = values.join(' ');
        });
        
        // Skip if all values in rowObj are blank
        if (Object.values(rowObj).some(val => val !== '')) {
          dataRows.push(rowObj);
        }
      }

      if (dataRows.length === 0) {
        throw new Error("No data rows found below header.");
      }

      setParsedHeaders(headers);
      setParsedRows(dataRows);

      // Fetch existing system entries to perform conflict check
      const cid = getActiveCompanyId();
      const existing = await fetchExistingEntries(cid);
      setExistingEntries(existing);

      // Identify conflicts
      const conflictList: ConflictItem[] = [];

      dataRows.forEach((row, index) => {
        const matches: any[] = [];

        if (activeTab === 'customers' || activeTab === 'vendors') {
          const rowName = cleanStr(getValue(row, ['Customer Name', 'Vendor Name', 'Name', 'Party Name', 'Account Name']));
          const rowPhone = cleanStr(getValue(row, ['Phone', 'Mobile', 'Contact', 'Phone Number']));
          const rowGst = cleanStr(getValue(row, ['GSTIN', 'GST', 'GST Number', 'GSTIN/UIN', 'GSTIN / UIN']));

          existing.forEach((item: any) => {
            const sysName = cleanStr(item.name);
            const sysPhone = cleanStr(item.phone);
            const sysGst = cleanStr(item.gstin);

            if ((rowName && rowName === sysName) || (rowPhone && rowPhone === sysPhone && rowPhone.length >= 7) || (rowGst && rowGst === sysGst && rowGst.length >= 10)) {
              matches.push(item);
            }
          });
        } else if (activeTab === 'stock_items') {
          const rowName = cleanStr(getValue(row, ['Item Name', 'Name', 'Product Name', 'Item']));

          existing.forEach((item: any) => {
            const sysName = cleanStr(item.name);

            if (rowName && rowName === sysName) {
              matches.push(item);
            }
          });
        } else if (activeTab === 'stock_groups') {
          const rowName = cleanStr(getValue(row, ['Group Name', 'Name', 'Category', 'Group']));

          existing.forEach((item: any) => {
            const sysName = cleanStr(item.name);
            if (rowName && rowName === sysName) {
              matches.push(item);
            }
          });
        }

        if (matches.length > 0) {
          conflictList.push({
            importedRow: row,
            importedRowIndex: index,
            matchingSystemEntries: matches,
            resolution: 'remap', // Default to remap
            targetSystemId: matches[0]?.id
          });
        }
      });

      setConflicts(conflictList);

    } catch (err: any) {
      console.error("File processing error:", err);
      setErrorMsg(err.message || "Failed to process file. Make sure it's a valid CSV or Excel document.");
      setParsedHeaders([]);
      setParsedRows([]);
    } finally {
      setScanning(false);
    }
  };

  // Set resolution for a conflict item
  const updateConflictResolution = (rowIndex: number, res: 'remap' | 'discard', targetId?: string) => {
    setConflicts(prev => prev.map(c => {
      if (c.importedRowIndex === rowIndex) {
        return {
          ...c,
          resolution: res,
          targetSystemId: targetId || c.matchingSystemEntries[0]?.id
        };
      }
      return c;
    }));
  };

  // Bulk actions for conflicts
  const setAllConflictsResolution = (res: 'remap' | 'discard') => {
    setConflicts(prev => prev.map(c => ({
      ...c,
      resolution: res,
      targetSystemId: c.matchingSystemEntries[0]?.id
    })));
  };

  // =========================================================================
  // STEP 3: Save / Import Execution
  // =========================================================================
  const handleImportSubmit = async () => {
    if (parsedRows.length === 0) return;
    setLoading(true);
    setErrorMsg('');

    try {
      const cid = getActiveCompanyId();
      if (!cid) throw new Error("No active workspace selected.");

      let newCount = 0;
      let remappedCount = 0;
      let discardedCount = 0;

      // Conflict map for quick lookup by rowIndex
      const conflictMap = new Map<number, ConflictItem>();
      conflicts.forEach(c => conflictMap.set(c.importedRowIndex, c));

      for (let i = 0; i < parsedRows.length; i++) {
        const row = parsedRows[i];
        const conflict = conflictMap.get(i);

        // Check if discarded
        if (conflict && conflict.resolution === 'discard') {
          discardedCount++;
          continue;
        }

        // Handle Customers
        if (activeTab === 'customers') {
          const custName = getValue(row, ['Customer Name', 'Customer', 'Name', 'Party Name', 'Account Name']);
          if (!custName) continue;

          const gstin = getValue(row, ['GSTIN', 'GST', 'GST Number', 'GSTIN/UIN', 'GSTIN / UIN']);
          const phone = getValue(row, ['Phone', 'Mobile', 'Contact', 'Phone Number']);
          const email = getValue(row, ['Email', 'Email Address']);
          const state = getValue(row, ['State', 'Place of Supply', 'State Name']);
          const balanceRaw = getValue(row, ['Opening Balance', 'Balance', 'Opening Bal', 'Opening Balance (Rs)']);
          const balance = toStorageValue(balanceRaw || 0);

          const payload = {
            name: custName,
            phone: phone,
            email: email,
            gstin: gstin,
            state: state,
            balance: balance,
            party_type: 'customer',
            is_customer: true,
            company_id: cid,
            is_deleted: false
          };

          if (conflict && conflict.resolution === 'remap' && conflict.targetSystemId) {
            await safeSupabaseSave('vendors', payload, conflict.targetSystemId);
            try { await safeSupabaseSave('customers', payload, conflict.targetSystemId); } catch (e) {}
            remappedCount++;
          } else {
            await safeSupabaseSave('vendors', payload);
            try { await safeSupabaseSave('customers', payload); } catch (e) {}
            newCount++;
          }
        }

        // Handle Vendors
        else if (activeTab === 'vendors') {
          const vendorName = getValue(row, ['Vendor Name', 'Vendor', 'Name', 'Party Name', 'Account Name']);
          if (!vendorName) continue;

          const gstin = getValue(row, ['GSTIN', 'GST', 'GST Number', 'GSTIN/UIN', 'GSTIN / UIN']);
          const phone = getValue(row, ['Phone', 'Mobile', 'Contact', 'Phone Number']);
          const email = getValue(row, ['Email', 'Email Address']);
          const state = getValue(row, ['State', 'Place of Supply', 'State Name']);
          const balanceRaw = getValue(row, ['Opening Balance', 'Balance', 'Opening Bal', 'Opening Balance (Rs)']);
          const balance = toStorageValue(balanceRaw || 0);

          const payload = {
            name: vendorName,
            phone: phone,
            email: email,
            gstin: gstin,
            state: state,
            balance: balance,
            party_type: 'vendor',
            is_customer: false,
            company_id: cid,
            is_deleted: false
          };

          if (conflict && conflict.resolution === 'remap' && conflict.targetSystemId) {
            await safeSupabaseSave('vendors', payload, conflict.targetSystemId);
            remappedCount++;
          } else {
            await safeSupabaseSave('vendors', payload);
            newCount++;
          }
        }

        // Handle Stock Items
        else if (activeTab === 'stock_items') {
          const itemName = getValue(row, ['Item Name', 'Name', 'Product Name', 'Item']);
          if (!itemName) continue;

          const hsn = getValue(row, ['HSN / SAC', 'HSN/SAC', 'HSN Code', 'HSN', 'SAC']);
          const purchaseRateRaw = getValue(row, ['Purchase Rate', 'Purchase Price', 'Rate', 'Cost Price']);
          const sellingPriceRaw = getValue(row, ['Selling Price', 'Sale Price', 'Selling Rate', 'Price']);
          const openingStockRaw = getValue(row, ['Opening Stock', 'Stock', 'Qty', 'Quantity']);

          const payload = {
            name: itemName,
            hsn: hsn,
            rate: toStorageValue(purchaseRateRaw || 0),
            selling_price: toStorageValue(sellingPriceRaw || 0),
            in_stock: toStorageValue(openingStockRaw || 0),
            unit: getValue(row, ['Unit', 'UOM']) || 'PCS',
            category: getValue(row, ['Category', 'Group']) || 'General',
            tax_rate: toStorageValue(getValue(row, ['Tax Rate (%)', 'Tax Rate', 'GST Rate']) || 18),
            company_id: cid,
            is_deleted: false
          };

          if (conflict && conflict.resolution === 'remap' && conflict.targetSystemId) {
            await supabase.from('stock_items').update(payload).eq('id', conflict.targetSystemId);
            remappedCount++;
          } else {
            await supabase.from('stock_items').insert([{ ...payload, company_id: cid }]);
            newCount++;
          }
        }

        // Handle Stock Groups
        else if (activeTab === 'stock_groups') {
          const groupName = getValue(row, ['Group Name', 'Name', 'Category', 'Group']);
          if (!groupName) continue;

          const parentGroup = getValue(row, ['Parent Group', 'Parent', 'Parent Category']) || 'Primary';
          const description = getValue(row, ['Description', 'Notes', 'Details']);

          const payload = {
            name: groupName,
            parent_group: parentGroup,
            description: description,
            company_id: cid,
            is_deleted: false
          };

          try {
            if (conflict && conflict.resolution === 'remap' && conflict.targetSystemId) {
              await supabase.from('stock_groups').update(payload).eq('id', conflict.targetSystemId);
              remappedCount++;
            } else {
              const { error } = await supabase.from('stock_groups').insert([{ ...payload, company_id: cid }]);
              if (error) {
                console.warn("stock_groups table insert note:", error.message);
              }
              newCount++;
            }
          } catch (e) {
            console.warn("Fallback group save:", e);
            newCount++;
          }
        }
      }

      const msg = `Successfully imported data! (${newCount} new created, ${remappedCount} remapped/updated${discardedCount > 0 ? `, ${discardedCount} discarded` : ''})`;
      setSuccessMessage(msg);
      setImportSuccess(true);

      // Trigger app refresh
      window.dispatchEvent(new Event('appSettingsChanged'));
      if (onSuccess) onSuccess();

    } catch (err: any) {
      console.error("Import execution error:", err);
      setErrorMsg(`Import failed: ${err.message || 'Unknown error occurred during import'}`);
    } finally {
      setLoading(false);
    }
  };

  const tabs: { id: TabType; label: string; icon: any }[] = [
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'vendors', label: 'Vendors', icon: ShoppingCart },
    { id: 'stock_items', label: 'Stock Items', icon: Package },
    { id: 'stock_groups', label: 'Stock Groups', icon: Layers },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Import Excel / CSV Data" maxWidth="max-w-5xl">
      <div className="flex flex-col h-[82vh] bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 overflow-hidden">
        
        {/* Navigation Tabs Header */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 pt-3 shrink-0 gap-2 overflow-x-auto custom-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold rounded-t-lg transition-all border-t border-x ${
                  isActive
                    ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-emerald-600 dark:text-emerald-400 border-b-2 border-b-emerald-600 shadow-xs'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Main Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar">
          
          {/* Success Screen */}
          {importSuccess ? (
            <div className="py-12 flex flex-col items-center justify-center text-center animate-in zoom-in-95 duration-300">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mb-4 border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Import Complete!</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 max-w-md mb-8">{successMessage}</p>
              <div className="flex space-x-4">
                <button
                  onClick={resetTabState}
                  className="px-5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-2" />
                  Import More
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-md transition-all"
                >
                  Close Window
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Error Banner */}
              {errorMsg && (
                <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg flex items-start space-x-3 text-rose-700 dark:text-rose-300 text-xs animate-in fade-in duration-200">
                  <AlertTriangle className="w-5 h-5 shrink-0 text-rose-500" />
                  <div className="flex-1">
                    <p className="font-bold">Import Error</p>
                    <p className="mt-0.5">{errorMsg}</p>
                  </div>
                </div>
              )}

              {/* Two Steps Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                
                {/* STEP 1: Download Template */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-5 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center space-x-2 text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-2">
                      <span className="w-5 h-5 bg-emerald-600 text-white rounded-full flex items-center justify-center text-[11px]">1</span>
                      <span>Step 1: Download Template</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                      Download the formatted CSV sample template for <strong className="text-slate-800 dark:text-slate-200 capitalize">{activeTab.replace('_', ' ')}</strong>. Fill in your entries keeping column headers intact.
                    </p>
                  </div>

                  <button
                    onClick={handleDownloadTemplate}
                    className="w-full py-3 px-4 border border-emerald-600/30 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-lg text-xs font-bold flex items-center justify-center space-x-2 transition-all shadow-xs"
                  >
                    <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Download {activeTab === 'customers' ? 'Customers' : activeTab === 'vendors' ? 'Vendors' : activeTab === 'stock_items' ? 'Stock Items' : 'Stock Groups'} CSV Template</span>
                  </button>
                </div>

                {/* STEP 2: Upload CSV File */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-5 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center space-x-2 text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-2">
                      <span className="w-5 h-5 bg-emerald-600 text-white rounded-full flex items-center justify-center text-[11px]">2</span>
                      <span>Step 2: Upload CSV / Excel File</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                      Upload your populated CSV or Excel file (`.csv`, `.xlsx`, `.xls`). Data will be automatically extracted and checked for duplicates.
                    </p>
                  </div>

                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv, .xlsx, .xls"
                      onChange={handleFileChange}
                      disabled={!downloadedTabs[activeTab]}
                      className="hidden"
                      id="excel-file-input"
                    />
                    <label
                      htmlFor={downloadedTabs[activeTab] ? "excel-file-input" : undefined}
                      className={`w-full py-3 px-4 rounded-lg text-xs font-bold flex items-center justify-center space-x-2 transition-all ${
                        !downloadedTabs[activeTab]
                          ? 'bg-slate-200 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-300/80 dark:border-slate-700/80 shadow-none'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-md'
                      }`}
                    >
                      {scanning ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          <span>Scanning File...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          <span>{file ? file.name : 'Select / Drop CSV File'}</span>
                        </>
                      )}
                    </label>
                    {!downloadedTabs[activeTab] && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-2 text-center flex items-center justify-center">
                        <AlertTriangle className="w-3 h-3 mr-1 inline shrink-0 text-amber-500" />
                        Please download CSV template in Step 1 first
                      </p>
                    )}
                  </div>
                </div>

              </div>

              {/* Data Preview & Conflict Resolution Section */}
              {parsedRows.length > 0 && (
                <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  
                  {/* Summary Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 gap-2">
                    <div className="flex items-center space-x-2">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        {parsedRows.length} {parsedRows.length === 1 ? 'row' : 'rows'} scanned from file
                      </span>
                      {conflicts.length > 0 && (
                        <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-[11px] font-bold rounded-full flex items-center">
                          <AlertTriangle className="w-3 h-3 mr-1 text-amber-500" />
                          {conflicts.length} {conflicts.length === 1 ? 'duplicate' : 'duplicates'} found
                        </span>
                      )}
                    </div>

                    {/* Bulk Conflict Options */}
                    {conflicts.length > 0 && (
                      <div className="flex items-center space-x-2 text-xs">
                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Bulk duplicates:</span>
                        <button
                          type="button"
                          onClick={() => setAllConflictsResolution('remap')}
                          className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-800 dark:text-amber-300 rounded font-bold text-[10px] transition-all"
                        >
                          Remap All
                        </button>
                        <button
                          type="button"
                          onClick={() => setAllConflictsResolution('discard')}
                          className="px-2.5 py-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded font-bold text-[10px] transition-all"
                        >
                          Discard All
                        </button>
                      </div>
                    )}
                  </div>

                  {/* DUPLICATE WARNING BOX IF CONFLICTS EXIST */}
                  {conflicts.length > 0 && (
                    <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/80 rounded-xl space-y-4">
                      <div className="flex items-center space-x-2 text-amber-800 dark:text-amber-300 text-xs font-bold">
                        <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Existing Entries Detected in System</span>
                      </div>
                      <p className="text-xs text-amber-900/80 dark:text-amber-200/80 leading-relaxed">
                        The entries listed below already exist inside your workspace. Choose whether to <strong>Remap</strong> (replace/update existing record with imported data) or <strong>Discard</strong> (skip import for that item).
                      </p>

                      <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                        {conflicts.map((item, cIdx) => {
                          const rowName = item.importedRow['Name'] || item.importedRow['Customer Name'] || item.importedRow['Vendor Name'] || item.importedRow['Item Name'] || item.importedRow['Group Name'] || 'Unnamed';
                          const hasMultipleMatches = item.matchingSystemEntries.length > 1;

                          return (
                            <div key={cIdx} className="p-3 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/60 rounded-lg text-xs space-y-2 shadow-2xs">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center space-x-2">
                                  <span>Imported Row #{item.importedRowIndex + 1}: {rowName}</span>
                                  {hasMultipleMatches && (
                                    <span className="px-1.5 py-0.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] rounded font-bold">
                                      {item.matchingSystemEntries.length} matching system records
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center space-x-2">
                                  <button
                                    type="button"
                                    onClick={() => updateConflictResolution(item.importedRowIndex, 'remap')}
                                    className={`px-3 py-1 text-xs font-bold rounded transition-all flex items-center ${
                                      item.resolution === 'remap'
                                        ? 'bg-amber-600 text-white shadow-xs'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                    }`}
                                  >
                                    Remap (Replace)
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateConflictResolution(item.importedRowIndex, 'discard')}
                                    className={`px-3 py-1 text-xs font-bold rounded transition-all flex items-center ${
                                      item.resolution === 'discard'
                                        ? 'bg-rose-600 text-white shadow-xs'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                    }`}
                                  >
                                    Discard (Skip)
                                  </button>
                                </div>
                              </div>

                              {/* Listing system records match */}
                              {item.resolution === 'remap' && (
                                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
                                  <span className="font-semibold text-amber-700 dark:text-amber-400">Target system record to overwrite:</span>
                                  {hasMultipleMatches ? (
                                    <select
                                      value={item.targetSystemId || item.matchingSystemEntries[0]?.id}
                                      onChange={(e) => updateConflictResolution(item.importedRowIndex, 'remap', e.target.value)}
                                      className="w-full mt-1 p-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded outline-none text-xs text-slate-900 dark:text-slate-100 font-medium"
                                    >
                                      {item.matchingSystemEntries.map((sys: any) => (
                                        <option key={sys.id} value={sys.id}>
                                          {sys.name} {sys.phone ? `(${sys.phone})` : ''} {sys.sku ? `[SKU: ${sys.sku}]` : ''} [ID: {String(sys.id).substring(0, 8)}]
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <div className="p-1.5 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 font-mono text-[11px]">
                                      Existing: {item.matchingSystemEntries[0]?.name} {item.matchingSystemEntries[0]?.phone ? `(${item.matchingSystemEntries[0]?.phone})` : ''} {item.matchingSystemEntries[0]?.sku ? `[SKU: ${item.matchingSystemEntries[0]?.sku}]` : ''}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Scanned Data Preview Table */}
                  <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-2xs">
                    <div className="bg-slate-100 dark:bg-slate-800/80 px-4 py-2 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Scanned CSV Data Preview</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">{parsedRows.length} rows</span>
                    </div>

                    <div className="max-h-64 overflow-x-auto overflow-y-auto custom-scrollbar">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 font-bold sticky top-0">
                            <th className="p-2.5 w-12 text-center border-r border-slate-200 dark:border-slate-700">#</th>
                            {parsedHeaders.map((h, idx) => (
                              <th key={idx} className="p-2.5 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap">{h}</th>
                            ))}
                            <th className="p-2.5 w-24 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                          {parsedRows.map((row, rIdx) => {
                            const conflict = conflicts.find(c => c.importedRowIndex === rIdx);
                            let statusText = 'New';
                            let statusBadgeClass = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';

                            if (conflict) {
                              if (conflict.resolution === 'remap') {
                                statusText = 'Remap';
                                statusBadgeClass = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
                              } else {
                                statusText = 'Discard';
                                statusBadgeClass = 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20';
                              }
                            }

                            return (
                              <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                <td className="p-2.5 text-center font-mono text-[11px] text-slate-400 border-r border-slate-200 dark:border-slate-800">{rIdx + 1}</td>
                                {parsedHeaders.map((h, cIdx) => (
                                  <td key={cIdx} className="p-2.5 border-r border-slate-200 dark:border-slate-800 max-w-[200px] truncate">
                                    {row[h] || <span className="text-slate-300 dark:text-slate-600 italic">-</span>}
                                  </td>
                                ))}
                                <td className="p-2.5 text-center whitespace-nowrap">
                                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${statusBadgeClass}`}>
                                    {statusText}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              )}
            </>
          )}

        </div>

        {/* Modal Footer Controls */}
        {!importSuccess && (
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-lg text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all disabled:opacity-50"
            >
              Cancel
            </button>

            {parsedRows.length > 0 && (
              <button
                type="button"
                onClick={handleImportSubmit}
                disabled={loading || scanning}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-md transition-all flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Importing Entries...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Import {parsedRows.filter((_, idx) => conflicts.find(c => c.importedRowIndex === idx)?.resolution !== 'discard').length} Entries</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}

      </div>
    </Modal>
  );
};

export default ImportExcelModal;
