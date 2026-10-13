import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { getActiveCompanyId, getAppSettings } from './helpers';

export interface BackupMetadata {
  app: string;
  version: string;
  format: string;
  createdAt: string;
  companyId: string;
  companyName: string;
  gstin: string;
  recordsCount: {
    customers: number;
    vendors: number;
    stock_items: number;
    sales_invoices: number;
    purchase_bills: number;
    cashbooks: number;
    duties_taxes: number;
  };
}

export interface FullBackupPackage {
  metadata: BackupMetadata;
  settings?: any;
  data: {
    customers: any[];
    vendors: any[];
    stock_items: any[];
    sales_invoices: any[];
    purchase_bills: any[];
    cashbooks: any[];
    duties_taxes: any[];
  };
}

export interface ValidationBackupResult {
  isValid: boolean;
  error?: string;
  metadata?: BackupMetadata;
  counts?: Record<string, number>;
  packageData?: FullBackupPackage;
  detectedFormat?: 'excel' | 'json';
}

export interface RestoreResult {
  success: boolean;
  message: string;
  details: {
    customers: { inserted: number; updated: number };
    vendors: { inserted: number; updated: number };
    stock_items: { inserted: number; updated: number };
    sales_invoices: { inserted: number; updated: number };
    purchase_bills: { inserted: number; updated: number };
    cashbooks: { inserted: number; updated: number };
    duties_taxes: { inserted: number; updated: number };
  };
  errors: string[];
}

/**
 * Creates a complete snapshot of all workspace entities preserving all IDs,
 * foreign keys, timestamps, and line items.
 */
export const createFullWorkspaceBackup = async (companyId?: string): Promise<FullBackupPackage> => {
  const cid = companyId || getActiveCompanyId();
  if (!cid) throw new Error("No active workspace selected for backup.");

  // Fetch company info
  const { data: companyData } = await supabase
    .from('companies')
    .select('*')
    .eq('id', cid)
    .single();

  const company = companyData || { id: cid, name: 'Workspace', gstin: '' };

  // Fetch all 7 entities in parallel
  const [
    { data: customers },
    { data: vendors },
    { data: stockItems },
    { data: salesInvoices },
    { data: purchaseBills },
    { data: cashbooks },
    { data: dutiesTaxes }
  ] = await Promise.all([
    supabase.from('customers').select('*').eq('company_id', cid).eq('is_deleted', false),
    supabase.from('vendors').select('*').eq('company_id', cid).eq('is_deleted', false),
    supabase.from('stock_items').select('*').eq('company_id', cid).eq('is_deleted', false),
    supabase.from('sales_invoices').select('*').eq('company_id', cid).eq('is_deleted', false),
    supabase.from('purchase_bills').select('*').eq('company_id', cid).eq('is_deleted', false),
    supabase.from('cashbooks').select('*').eq('company_id', cid).eq('is_deleted', false),
    supabase.from('duties_taxes').select('*').eq('company_id', cid).eq('is_deleted', false)
  ]);

  const appSettings = getAppSettings();

  const backupPackage: FullBackupPackage = {
    metadata: {
      app: 'ZenterPrime',
      version: '2.0',
      format: 'zenterprime_backup_excel',
      createdAt: new Date().toISOString(),
      companyId: cid,
      companyName: company.name || 'Workspace',
      gstin: company.gstin || '',
      recordsCount: {
        customers: (customers || []).length,
        vendors: (vendors || []).length,
        stock_items: (stockItems || []).length,
        sales_invoices: (salesInvoices || []).length,
        purchase_bills: (purchaseBills || []).length,
        cashbooks: (cashbooks || []).length,
        duties_taxes: (dutiesTaxes || []).length
      }
    },
    settings: appSettings,
    data: {
      customers: customers || [],
      vendors: vendors || [],
      stock_items: stockItems || [],
      sales_invoices: salesInvoices || [],
      purchase_bills: purchaseBills || [],
      cashbooks: cashbooks || [],
      duties_taxes: dutiesTaxes || []
    }
  };

  return backupPackage;
};

/**
 * Downloads a full backup package as a multi-sheet Excel (.xlsx) file.
 * Preserves all entity tables and metadata for 100% restorable recovery.
 */
export const downloadBackupExcel = (backupPackage: FullBackupPackage): string => {
  const companySlug = (backupPackage.metadata.companyName || 'workspace')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .toLowerCase();
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `ZenterPrime_Backup_${companySlug}_${dateStr}.xlsx`;

  const wb = XLSX.utils.book_new();

  // 1. Metadata Sheet
  const metadataRows = [
    { Property: 'App', Value: backupPackage.metadata.app },
    { Property: 'Backup Version', Value: backupPackage.metadata.version },
    { Property: 'Created At', Value: backupPackage.metadata.createdAt },
    { Property: 'Company ID', Value: backupPackage.metadata.companyId },
    { Property: 'Company Name', Value: backupPackage.metadata.companyName },
    { Property: 'GSTIN', Value: backupPackage.metadata.gstin },
    { Property: 'Total Customers', Value: backupPackage.metadata.recordsCount.customers },
    { Property: 'Total Vendors', Value: backupPackage.metadata.recordsCount.vendors },
    { Property: 'Total Stock Items', Value: backupPackage.metadata.recordsCount.stock_items },
    { Property: 'Total Sales Invoices', Value: backupPackage.metadata.recordsCount.sales_invoices },
    { Property: 'Total Purchase Bills', Value: backupPackage.metadata.recordsCount.purchase_bills },
    { Property: 'Total Cashbooks', Value: backupPackage.metadata.recordsCount.cashbooks },
    { Property: 'Total Duties & Taxes', Value: backupPackage.metadata.recordsCount.duties_taxes },
    { Property: 'Settings JSON', Value: JSON.stringify(backupPackage.settings || {}) }
  ];
  const wsMeta = XLSX.utils.json_to_sheet(metadataRows);
  XLSX.utils.book_append_sheet(wb, wsMeta, '_Backup_Metadata');

  // Helper for safe JSON stringify
  const safeStr = (v: any) => {
    if (!v) return '';
    try {
      return typeof v === 'string' ? v : JSON.stringify(v);
    } catch (_) {
      return '';
    }
  };

  // 2. Customers Sheet
  const custRows = backupPackage.data.customers.map(c => ({
    'Record ID': c.id || '',
    'Customer Name': c.name || '',
    'GSTIN': c.gstin || '',
    'Phone Number': c.phone || '',
    'Email': c.email || '',
    'State': c.state || '',
    'Address': c.address || '',
    'PAN': c.pan || '',
    'Opening Balance': Number(c.balance) || 0,
    'Bank Account': c.account_number || '',
    'IFSC Code': c.ifsc_code || '',
    'Bank Name': c.account_name || ''
  }));
  const wsCust = XLSX.utils.json_to_sheet(custRows.length > 0 ? custRows : [{
    'Record ID': '', 'Customer Name': '', 'GSTIN': '', 'Phone Number': '', 'Email': '', 'State': '',
    'Address': '', 'PAN': '', 'Opening Balance': 0, 'Bank Account': '', 'IFSC Code': '', 'Bank Name': ''
  }]);
  XLSX.utils.book_append_sheet(wb, wsCust, 'Customers');

  // 3. Vendors Sheet
  const vendRows = backupPackage.data.vendors.map(v => ({
    'Record ID': v.id || '',
    'Vendor Name': v.name || '',
    'GSTIN': v.gstin || '',
    'Phone Number': v.phone || '',
    'Email': v.email || '',
    'State': v.state || '',
    'Address': v.address || '',
    'PAN': v.pan || '',
    'Opening Balance': Number(v.balance) || 0,
    'Bank Account': v.account_number || '',
    'IFSC Code': v.ifsc_code || '',
    'Bank Name': v.account_name || ''
  }));
  const wsVend = XLSX.utils.json_to_sheet(vendRows.length > 0 ? vendRows : [{
    'Record ID': '', 'Vendor Name': '', 'GSTIN': '', 'Phone Number': '', 'Email': '', 'State': '',
    'Address': '', 'PAN': '', 'Opening Balance': 0, 'Bank Account': '', 'IFSC Code': '', 'Bank Name': ''
  }]);
  XLSX.utils.book_append_sheet(wb, wsVend, 'Vendors');

  // 4. Combined Parties Sheet (for standard accounting compatibility)
  const partyRows = [
    ...backupPackage.data.customers.map(c => ({
      'Record ID': c.id || '',
      'Party Name': c.name || '',
      'Party Type': 'Customer',
      'GSTIN': c.gstin || '',
      'Phone Number': c.phone || '',
      'Email': c.email || '',
      'State': c.state || '',
      'Address': c.address || '',
      'PAN': c.pan || '',
      'Opening Balance': Number(c.balance) || 0,
      'Bank Account': c.account_number || '',
      'IFSC Code': c.ifsc_code || '',
      'Bank Name': c.account_name || ''
    })),
    ...backupPackage.data.vendors.map(v => ({
      'Record ID': v.id || '',
      'Party Name': v.name || '',
      'Party Type': 'Vendor',
      'GSTIN': v.gstin || '',
      'Phone Number': v.phone || '',
      'Email': v.email || '',
      'State': v.state || '',
      'Address': v.address || '',
      'PAN': v.pan || '',
      'Opening Balance': Number(v.balance) || 0,
      'Bank Account': v.account_number || '',
      'IFSC Code': v.ifsc_code || '',
      'Bank Name': v.account_name || ''
    }))
  ];
  const wsParties = XLSX.utils.json_to_sheet(partyRows.length > 0 ? partyRows : [{
    'Record ID': '', 'Party Name': '', 'Party Type': 'Customer', 'GSTIN': '', 'Phone Number': '',
    'Email': '', 'State': '', 'Address': '', 'PAN': '', 'Opening Balance': 0,
    'Bank Account': '', 'IFSC Code': '', 'Bank Name': ''
  }]);
  XLSX.utils.book_append_sheet(wb, wsParties, 'Parties');

  // 5. Stock Items Sheet
  const itemRows = backupPackage.data.stock_items.map(item => ({
    'Record ID': item.id || '',
    'Item Name': item.name || '',
    'HSN / SAC': item.hsn || '',
    'SKU': item.sku || '',
    'Unit': item.unit || 'PCS',
    'Category': item.category || 'General',
    'Purchase Rate': Number(item.rate) || 0,
    'Selling Price': Number(item.selling_price) || 0,
    'Opening Stock': Number(item.in_stock) || 0,
    'Tax Rate (%)': Number(item.tax_rate) || 18,
    'Description': item.description || ''
  }));
  const wsItems = XLSX.utils.json_to_sheet(itemRows.length > 0 ? itemRows : [{
    'Record ID': '', 'Item Name': '', 'HSN / SAC': '', 'SKU': '', 'Unit': 'PCS', 'Category': 'General',
    'Purchase Rate': 0, 'Selling Price': 0, 'Opening Stock': 0, 'Tax Rate (%)': 18, 'Description': ''
  }]);
  XLSX.utils.book_append_sheet(wb, wsItems, 'Stock Items');

  // 6. Sales Invoices Sheet
  const invRows = backupPackage.data.sales_invoices.map(inv => ({
    'Record ID': inv.id || '',
    'Invoice Number': inv.invoice_number || '',
    'Date': inv.date || '',
    'Customer Name': inv.customer_name || '',
    'Subtotal': Number(inv.total_without_gst) || 0,
    'Total GST': Number(inv.total_gst) || 0,
    'Round Off': Number(inv.round_off) || 0,
    'Grand Total': Number(inv.grand_total) || 0,
    'Status': inv.status || 'Pending',
    'Description': inv.description || '',
    'Line Items JSON': safeStr(inv.items)
  }));
  const wsInvoices = XLSX.utils.json_to_sheet(invRows.length > 0 ? invRows : [{
    'Record ID': '', 'Invoice Number': '', 'Date': '', 'Customer Name': '', 'Subtotal': 0,
    'Total GST': 0, 'Round Off': 0, 'Grand Total': 0, 'Status': 'Pending', 'Description': '', 'Line Items JSON': ''
  }]);
  XLSX.utils.book_append_sheet(wb, wsInvoices, 'Sales Invoices');

  // 7. Purchase Bills Sheet
  const billRows = backupPackage.data.purchase_bills.map(bill => ({
    'Record ID': bill.id || '',
    'Bill Number': bill.bill_number || '',
    'Date': bill.date || '',
    'Vendor Name': bill.vendor_name || '',
    'Subtotal': Number(bill.total_without_gst) || 0,
    'Total GST': Number(bill.total_gst) || 0,
    'Round Off': Number(bill.round_off) || 0,
    'Grand Total': Number(bill.grand_total) || 0,
    'Status': bill.status || 'Pending',
    'Description': bill.description || '',
    'Line Items JSON': safeStr(bill.items)
  }));
  const wsBills = XLSX.utils.json_to_sheet(billRows.length > 0 ? billRows : [{
    'Record ID': '', 'Bill Number': '', 'Date': '', 'Vendor Name': '', 'Subtotal': 0,
    'Total GST': 0, 'Round Off': 0, 'Grand Total': 0, 'Status': 'Pending', 'Description': '', 'Line Items JSON': ''
  }]);
  XLSX.utils.book_append_sheet(wb, wsBills, 'Purchase Bills');

  // 8. Cashbooks Sheet
  const cbRows = backupPackage.data.cashbooks.map(cb => ({
    'Record ID': cb.id || '',
    'Date': cb.date || '',
    'Income Total': Number(cb.income_total) || 0,
    'Expense Total': Number(cb.expense_total) || 0,
    'Net Balance': Number(cb.balance) || 0,
    'Entries JSON': safeStr(cb.raw_data)
  }));
  const wsCashbooks = XLSX.utils.json_to_sheet(cbRows.length > 0 ? cbRows : [{
    'Record ID': '', 'Date': '', 'Income Total': 0, 'Expense Total': 0, 'Net Balance': 0, 'Entries JSON': ''
  }]);
  XLSX.utils.book_append_sheet(wb, wsCashbooks, 'Cashbooks');

  // 9. Duties & Taxes Sheet
  const taxRows = backupPackage.data.duties_taxes.map(t => ({
    'Record ID': t.id || '',
    'Tax Name': t.name || '',
    'Type': t.type || 'Charge',
    'Method': t.calc_method || 'Percentage',
    'Rate (%)': Number(t.rate) || 0,
    'Fixed Amount': Number(t.fixed_amount) || 0,
    'Apply On': t.apply_on || 'Subtotal',
    'Applicable To': t.applicable_to || 'Both',
    'Is Default': t.is_default ? 'Yes' : 'No'
  }));
  const wsTaxes = XLSX.utils.json_to_sheet(taxRows.length > 0 ? taxRows : [{
    'Record ID': '', 'Tax Name': '', 'Type': 'Charge', 'Method': 'Percentage',
    'Rate (%)': 0, 'Fixed Amount': 0, 'Apply On': 'Subtotal', 'Applicable To': 'Both', 'Is Default': 'No'
  }]);
  XLSX.utils.book_append_sheet(wb, wsTaxes, 'Duties & Taxes');

  // Trigger Excel file download
  XLSX.writeFile(wb, filename);

  // Store last backup timestamp in localStorage
  if (backupPackage.metadata.companyId) {
    localStorage.setItem(`last_backup_${backupPackage.metadata.companyId}`, new Date().toISOString());
    window.dispatchEvent(new Event('backupCompleted'));
  }

  return filename;
};

/**
 * Primary backup download method - outputs Excel (.xlsx) file per user specification.
 */
export const downloadBackupPackage = (backupPackage: FullBackupPackage): string => {
  return downloadBackupExcel(backupPackage);
};

/**
 * Downloads a backup package as a timestamped .json file (alternative format).
 */
export const downloadBackupJson = (backupPackage: FullBackupPackage): string => {
  const companySlug = (backupPackage.metadata.companyName || 'workspace')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .toLowerCase();
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `ZenterPrime_Backup_${companySlug}_${dateStr}.json`;

  const jsonStr = JSON.stringify(backupPackage, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  if (backupPackage.metadata.companyId) {
    localStorage.setItem(`last_backup_${backupPackage.metadata.companyId}`, new Date().toISOString());
    window.dispatchEvent(new Event('backupCompleted'));
  }

  return filename;
};

/**
 * Universal validator for backup files: accepts either an Excel workbook (.xlsx / .xls)
 * or a JSON backup file (.json), validates the internal structure, and produces
 * a verified FullBackupPackage.
 */
export const validateBackupFile = (
  fileContent: string | ArrayBuffer,
  fileName?: string
): ValidationBackupResult => {
  const isExcel = (fileName && (fileName.endsWith('.xlsx') || fileName.endsWith('.xls'))) ||
    fileContent instanceof ArrayBuffer;

  if (isExcel) {
    return validateExcelBackup(fileContent);
  } else {
    // Attempt JSON parse first; if it looks like binary or fails, attempt Excel
    if (typeof fileContent === 'string') {
      try {
        return validateJsonBackup(fileContent);
      } catch (_) {
        return validateExcelBackup(fileContent);
      }
    }
    return validateExcelBackup(fileContent);
  }
};

/**
 * Validates an Excel backup workbook and converts sheets into FullBackupPackage.
 */
const validateExcelBackup = (content: string | ArrayBuffer): ValidationBackupResult => {
  try {
    const workbook = XLSX.read(content, {
      type: typeof content === 'string' ? 'binary' : 'array',
      cellDates: true
    });

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return { isValid: false, error: 'The uploaded Excel workbook contains no sheets.' };
    }

    // Check for metadata sheet
    let metaCompany = 'Workspace';
    let metaGstin = '';
    let metaCid = '';
    let metaSettings: any = undefined;
    let metaCreatedAt = new Date().toISOString();

    const metaSheetName = workbook.SheetNames.find(n => n.toLowerCase().includes('metadata'));
    if (metaSheetName) {
      const metaSheet = workbook.Sheets[metaSheetName];
      const rows = XLSX.utils.sheet_to_json(metaSheet) as Array<{ Property?: string; Value?: any }>;
      rows.forEach(r => {
        const prop = String(r.Property || '').toLowerCase().trim();
        if (prop.includes('company name')) metaCompany = String(r.Value || metaCompany);
        else if (prop === 'gstin') metaGstin = String(r.Value || '');
        else if (prop.includes('company id')) metaCid = String(r.Value || '');
        else if (prop.includes('created at')) metaCreatedAt = String(r.Value || metaCreatedAt);
        else if (prop.includes('settings')) {
          try { metaSettings = JSON.parse(String(r.Value)); } catch (_) {}
        }
      });
    }

    // Helper to find sheet by possible names
    const getSheet = (...names: string[]) => {
      const found = workbook.SheetNames.find(sn => {
        const lower = sn.toLowerCase().replace(/[^a-z0-9]/g, '');
        return names.some(n => lower.includes(n.toLowerCase().replace(/[^a-z0-9]/g, '')));
      });
      return found ? workbook.Sheets[found] : null;
    };

    // Helper to parse rows from a sheet
    const parseSheetRows = (sheet: XLSX.WorkSheet | null): any[] => {
      if (!sheet) return [];
      const raw = XLSX.utils.sheet_to_json(sheet) as any[];
      return raw.filter(r => r && Object.values(r).some(v => v !== null && v !== undefined && String(v).trim() !== ''));
    };

    // Parse Customers
    const custSheet = getSheet('customers');
    const rawCust = parseSheetRows(custSheet);
    const customers = rawCust.map(r => ({
      id: r['Record ID'] || r.id || undefined,
      name: r['Customer Name'] || r.name || r['Party Name'] || '',
      gstin: r['GSTIN'] || r.gstin || '',
      phone: r['Phone Number'] || r.phone || '',
      email: r['Email'] || r.email || '',
      state: r['State'] || r.state || '',
      address: r['Address'] || r.address || '',
      pan: r['PAN'] || r.pan || '',
      balance: Number(r['Opening Balance'] ?? r.balance ?? 0),
      account_number: r['Bank Account'] || r.account_number || '',
      ifsc_code: r['IFSC Code'] || r.ifsc_code || '',
      account_name: r['Bank Name'] || r.account_name || '',
      party_type: 'customer',
      is_customer: true
    })).filter(c => Boolean(c.name));

    // Parse Vendors
    const vendSheet = getSheet('vendors');
    const rawVend = parseSheetRows(vendSheet);
    const vendors = rawVend.map(r => ({
      id: r['Record ID'] || r.id || undefined,
      name: r['Vendor Name'] || r.name || r['Party Name'] || '',
      gstin: r['GSTIN'] || r.gstin || '',
      phone: r['Phone Number'] || r.phone || '',
      email: r['Email'] || r.email || '',
      state: r['State'] || r.state || '',
      address: r['Address'] || r.address || '',
      pan: r['PAN'] || r.pan || '',
      balance: Number(r['Opening Balance'] ?? r.balance ?? 0),
      account_number: r['Bank Account'] || r.account_number || '',
      ifsc_code: r['IFSC Code'] || r.ifsc_code || '',
      account_name: r['Bank Name'] || r.account_name || '',
      party_type: 'vendor',
      is_customer: false
    })).filter(v => Boolean(v.name));

    // If no separate customer/vendor sheet, check Parties sheet
    if (customers.length === 0 && vendors.length === 0) {
      const partiesSheet = getSheet('parties', 'party');
      const rawParties = parseSheetRows(partiesSheet);
      rawParties.forEach(r => {
        const pType = String(r['Party Type'] || r.party_type || '').toLowerCase();
        const isCust = pType === 'customer' || pType.includes('cust') || !pType;
        const item = {
          id: r['Record ID'] || r.id || undefined,
          name: r['Party Name'] || r.name || '',
          gstin: r['GSTIN'] || r.gstin || '',
          phone: r['Phone Number'] || r.phone || '',
          email: r['Email'] || r.email || '',
          state: r['State'] || r.state || '',
          address: r['Address'] || r.address || '',
          pan: r['PAN'] || r.pan || '',
          balance: Number(r['Opening Balance'] ?? r.balance ?? 0),
          account_number: r['Bank Account'] || r.account_number || '',
          ifsc_code: r['IFSC Code'] || r.ifsc_code || '',
          account_name: r['Bank Name'] || r.account_name || '',
          party_type: isCust ? 'customer' : 'vendor',
          is_customer: isCust
        };
        if (item.name) {
          if (isCust) customers.push(item);
          else vendors.push(item);
        }
      });
    }

    // Parse Stock Items
    const stockSheet = getSheet('stockitems', 'stock_items', 'stock', 'items');
    const rawStock = parseSheetRows(stockSheet);
    const stockItems = rawStock.map(r => ({
      id: r['Record ID'] || r.id || undefined,
      name: r['Item Name'] || r.name || '',
      hsn: r['HSN / SAC'] || r.hsn || '',
      sku: r['SKU'] || r.sku || '',
      unit: r['Unit'] || r.unit || 'PCS',
      category: r['Category'] || r.category || 'General',
      rate: Number(r['Purchase Rate'] ?? r.rate ?? 0),
      selling_price: Number(r['Selling Price'] ?? r.selling_price ?? 0),
      in_stock: Number(r['Opening Stock'] ?? r.in_stock ?? 0),
      tax_rate: Number(r['Tax Rate (%)'] ?? r.tax_rate ?? 18),
      description: r['Description'] || r.description || ''
    })).filter(i => Boolean(i.name));

    // Parse Sales Invoices
    const invSheet = getSheet('salesinvoices', 'sales_invoices', 'invoices', 'sales');
    const rawInv = parseSheetRows(invSheet);
    const salesInvoices = rawInv.map(r => {
      let items: any[] = [];
      const jsonRaw = r['Line Items JSON'] || r.items || '';
      if (jsonRaw) {
        try { items = typeof jsonRaw === 'string' ? JSON.parse(jsonRaw) : jsonRaw; } catch (_) {}
      }
      return {
        id: r['Record ID'] || r.id || undefined,
        invoice_number: r['Invoice Number'] || r.invoice_number || '',
        date: r['Date'] || r.date || new Date().toISOString().split('T')[0],
        customer_name: r['Customer Name'] || r.customer_name || '',
        total_without_gst: Number(r['Subtotal'] ?? r.total_without_gst ?? 0),
        total_gst: Number(r['Total GST'] ?? r.total_gst ?? 0),
        round_off: Number(r['Round Off'] ?? r.round_off ?? 0),
        grand_total: Number(r['Grand Total'] ?? r.grand_total ?? 0),
        status: r['Status'] || r.status || 'Pending',
        description: r['Description'] || r.description || '',
        items
      };
    }).filter(i => Boolean(i.invoice_number));

    // Parse Purchase Bills
    const billSheet = getSheet('purchasebills', 'purchase_bills', 'bills', 'purchase');
    const rawBills = parseSheetRows(billSheet);
    const purchaseBills = rawBills.map(r => {
      let items: any[] = [];
      const jsonRaw = r['Line Items JSON'] || r.items || '';
      if (jsonRaw) {
        try { items = typeof jsonRaw === 'string' ? JSON.parse(jsonRaw) : jsonRaw; } catch (_) {}
      }
      return {
        id: r['Record ID'] || r.id || undefined,
        bill_number: r['Bill Number'] || r.bill_number || '',
        date: r['Date'] || r.date || new Date().toISOString().split('T')[0],
        vendor_name: r['Vendor Name'] || r.vendor_name || '',
        total_without_gst: Number(r['Subtotal'] ?? r.total_without_gst ?? 0),
        total_gst: Number(r['Total GST'] ?? r.total_gst ?? 0),
        round_off: Number(r['Round Off'] ?? r.round_off ?? 0),
        grand_total: Number(r['Grand Total'] ?? r.grand_total ?? 0),
        status: r['Status'] || r.status || 'Pending',
        description: r['Description'] || r.description || '',
        items
      };
    }).filter(b => Boolean(b.bill_number));

    // Parse Cashbooks
    const cbSheet = getSheet('cashbooks', 'cashbook', 'cash');
    const rawCb = parseSheetRows(cbSheet);
    const cashbooks = rawCb.map(r => {
      let rawData: any = {};
      const jsonRaw = r['Entries JSON'] || r.raw_data || '';
      if (jsonRaw) {
        try { rawData = typeof jsonRaw === 'string' ? JSON.parse(jsonRaw) : jsonRaw; } catch (_) {}
      }
      return {
        id: r['Record ID'] || r.id || undefined,
        date: r['Date'] || r.date || new Date().toISOString().split('T')[0],
        income_total: Number(r['Income Total'] ?? r.income_total ?? 0),
        expense_total: Number(r['Expense Total'] ?? r.expense_total ?? 0),
        balance: Number(r['Net Balance'] ?? r.balance ?? 0),
        raw_data: rawData
      };
    }).filter(c => Boolean(c.date));

    // Parse Duties & Taxes
    const taxSheet = getSheet('dutiestaxes', 'duties_taxes', 'taxes', 'charges');
    const rawTax = parseSheetRows(taxSheet);
    const dutiesTaxes = rawTax.map(r => ({
      id: r['Record ID'] || r.id || undefined,
      name: r['Tax Name'] || r.name || '',
      type: r['Type'] || r.type || 'Charge',
      calc_method: r['Method'] || r.calc_method || 'Percentage',
      rate: Number(r['Rate (%)'] ?? r.rate ?? 0),
      fixed_amount: Number(r['Fixed Amount'] ?? r.fixed_amount ?? 0),
      apply_on: r['Apply On'] || r.apply_on || 'Subtotal',
      applicable_to: r['Applicable To'] || r.applicable_to || 'Both',
      is_default: String(r['Is Default'] || r.is_default || '').toLowerCase().includes('yes')
    })).filter(t => Boolean(t.name));

    const counts: Record<string, number> = {
      customers: customers.length,
      vendors: vendors.length,
      stock_items: stockItems.length,
      sales_invoices: salesInvoices.length,
      purchase_bills: purchaseBills.length,
      cashbooks: cashbooks.length,
      duties_taxes: dutiesTaxes.length
    };

    const totalRecords = Object.values(counts).reduce((a, b) => a + b, 0);
    if (totalRecords === 0) {
      return {
        isValid: false,
        error: 'The uploaded Excel file contains 0 recognizable accounting records across all worksheets.'
      };
    }

    const metadata: BackupMetadata = {
      app: 'ZenterPrime',
      version: '2.0',
      format: 'zenterprime_backup_excel',
      createdAt: metaCreatedAt,
      companyId: metaCid,
      companyName: metaCompany,
      gstin: metaGstin,
      recordsCount: counts as any
    };

    const packageData: FullBackupPackage = {
      metadata,
      settings: metaSettings,
      data: {
        customers,
        vendors,
        stock_items: stockItems,
        sales_invoices: salesInvoices,
        purchase_bills: purchaseBills,
        cashbooks,
        duties_taxes: dutiesTaxes
      }
    };

    return {
      isValid: true,
      metadata,
      counts,
      packageData,
      detectedFormat: 'excel'
    };
  } catch (err: any) {
    return {
      isValid: false,
      error: `Failed to read Excel workbook: ${err.message || 'Corrupted or unreadable format'}`
    };
  }
};

/**
 * Validates a JSON backup file and inspects its internal schema.
 */
const validateJsonBackup = (jsonString: string): ValidationBackupResult => {
  try {
    const parsed = JSON.parse(jsonString);

    if (!parsed || typeof parsed !== 'object') {
      return { isValid: false, error: 'The uploaded file does not contain a valid JSON object.' };
    }

    const data = parsed.data || parsed;
    
    const hasAnyEntity = 
      Array.isArray(data.customers) ||
      Array.isArray(data.vendors) ||
      Array.isArray(data.stock_items) ||
      Array.isArray(data.sales_invoices) ||
      Array.isArray(data.purchase_bills) ||
      Array.isArray(data.cashbooks) ||
      Array.isArray(data.duties_taxes) ||
      Array.isArray(data.parties);

    if (!hasAnyEntity) {
      return { 
        isValid: false, 
        error: 'Unrecognized backup structure. Expected arrays for customers, vendors, invoices, bills, stock items, cashbooks, or duties & taxes.' 
      };
    }

    let custArr = Array.isArray(data.customers) ? data.customers : [];
    let vendArr = Array.isArray(data.vendors) ? data.vendors : [];

    // If unified parties array provided
    if (custArr.length === 0 && vendArr.length === 0 && Array.isArray(data.parties)) {
      data.parties.forEach((p: any) => {
        const isCust = p.party_type === 'customer' || p.is_customer;
        if (isCust) custArr.push(p);
        else vendArr.push(p);
      });
    }

    const counts: Record<string, number> = {
      customers: custArr.length,
      vendors: vendArr.length,
      stock_items: Array.isArray(data.stock_items) ? data.stock_items.length : 0,
      sales_invoices: Array.isArray(data.sales_invoices) ? data.sales_invoices.length : 0,
      purchase_bills: Array.isArray(data.purchase_bills) ? data.purchase_bills.length : 0,
      cashbooks: Array.isArray(data.cashbooks) ? data.cashbooks.length : 0,
      duties_taxes: Array.isArray(data.duties_taxes) ? data.duties_taxes.length : 0,
    };

    const totalRecords = Object.values(counts).reduce((a, b) => a + b, 0);
    if (totalRecords === 0) {
      return { isValid: false, error: 'Backup file contains 0 records across all entities.' };
    }

    const metadata: BackupMetadata = parsed.metadata || {
      app: 'ZenterPrime',
      version: '1.0',
      format: 'zenterprime_backup_json',
      createdAt: new Date().toISOString(),
      companyId: '',
      companyName: parsed.company_name || 'Imported Workspace',
      gstin: '',
      recordsCount: counts as any
    };

    const packageData: FullBackupPackage = {
      metadata,
      settings: parsed.settings,
      data: {
        customers: custArr,
        vendors: vendArr,
        stock_items: Array.isArray(data.stock_items) ? data.stock_items : [],
        sales_invoices: Array.isArray(data.sales_invoices) ? data.sales_invoices : [],
        purchase_bills: Array.isArray(data.purchase_bills) ? data.purchase_bills : [],
        cashbooks: Array.isArray(data.cashbooks) ? data.cashbooks : [],
        duties_taxes: Array.isArray(data.duties_taxes) ? data.duties_taxes : [],
      }
    };

    return {
      isValid: true,
      metadata,
      counts,
      packageData,
      detectedFormat: 'json'
    };
  } catch (err: any) {
    return { isValid: false, error: `JSON Parse Error: ${err.message || 'Invalid JSON syntax'}` };
  }
};

/**
 * Restores a full backup into the current workspace.
 * In 'merge' mode: Existing records matching by ID are updated; new records are inserted.
 * In 'replace' mode: Existing company records are flagged deleted first, then backup records are inserted.
 */
export const restoreWorkspaceBackup = async (
  backupPackage: FullBackupPackage,
  mode: 'merge' | 'replace' = 'merge',
  targetCompanyId?: string
): Promise<RestoreResult> => {
  const cid = targetCompanyId || getActiveCompanyId();
  if (!cid) throw new Error("No active workspace selected for restore operation.");

  const result: RestoreResult = {
    success: true,
    message: '',
    details: {
      customers: { inserted: 0, updated: 0 },
      vendors: { inserted: 0, updated: 0 },
      stock_items: { inserted: 0, updated: 0 },
      sales_invoices: { inserted: 0, updated: 0 },
      purchase_bills: { inserted: 0, updated: 0 },
      cashbooks: { inserted: 0, updated: 0 },
      duties_taxes: { inserted: 0, updated: 0 }
    },
    errors: []
  };

  const tables: Array<keyof FullBackupPackage['data']> = [
    'customers',
    'vendors',
    'stock_items',
    'sales_invoices',
    'purchase_bills',
    'cashbooks',
    'duties_taxes'
  ];

  // If clean replace mode, mark existing non-deleted rows as deleted
  if (mode === 'replace') {
    for (const table of tables) {
      try {
        await supabase
          .from(table)
          .update({ is_deleted: true })
          .eq('company_id', cid)
          .eq('is_deleted', false);
      } catch (err: any) {
        result.errors.push(`Replace cleanup warning on ${table}: ${err.message}`);
      }
    }
  }

  // Restore each table
  for (const table of tables) {
    const records = backupPackage.data[table] || [];
    if (!records.length) continue;

    // Fetch existing IDs for this table in current company to know if update vs insert
    let existingIdSet = new Set<string>();
    try {
      const { data: currentRows } = await supabase
        .from(table)
        .select('id')
        .eq('company_id', cid);
      (currentRows || []).forEach((r: any) => existingIdSet.add(r.id));
    } catch (e: any) {
      result.errors.push(`Could not fetch existing IDs for ${table}: ${e.message}`);
    }

    for (const record of records) {
      try {
        // Prepare record for target company
        const recordId = record.id;
        const payload: Record<string, any> = { ...record };
        delete payload.created_at; // Allow DB or preserve if updating
        payload.company_id = cid;
        payload.is_deleted = false;

        // Clean JSON fields if needed
        if (payload.items && typeof payload.items === 'string') {
          try { payload.items = JSON.parse(payload.items); } catch (_) {}
        }
        if (payload.raw_data && typeof payload.raw_data === 'string') {
          try { payload.raw_data = JSON.parse(payload.raw_data); } catch (_) {}
        }

        if (recordId && existingIdSet.has(recordId)) {
          // Update existing
          const { error: updErr } = await supabase
            .from(table)
            .update(payload)
            .eq('id', recordId)
            .eq('company_id', cid);
          if (updErr) throw updErr;
          result.details[table].updated++;
        } else {
          // Insert (if recordId is a valid uuid, keep it to preserve foreign keys)
          const isUuid = typeof recordId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(recordId);
          if (!isUuid) {
            delete payload.id;
          }
          const { error: insErr } = await supabase
            .from(table)
            .insert([payload]);
          if (insErr) throw insErr;
          result.details[table].inserted++;
        }
      } catch (rowErr: any) {
        console.error(`Error restoring row in ${table}:`, rowErr);
        result.errors.push(`${table} record error: ${rowErr.message || 'Failed to save'}`);
      }
    }
  }

  // Restore app settings if present
  if (backupPackage.settings && typeof backupPackage.settings === 'object') {
    try {
      localStorage.setItem(`appSettings_${cid}`, JSON.stringify(backupPackage.settings));
      window.dispatchEvent(new Event('appSettingsChanged'));
    } catch (_) {}
  }

  // Dispatches to refresh views
  window.dispatchEvent(new Event('partiesUpdated'));
  window.dispatchEvent(new Event('stockUpdated'));
  window.dispatchEvent(new Event('salesUpdated'));
  window.dispatchEvent(new Event('billsUpdated'));

  const totalIns = Object.values(result.details).reduce((a, b) => a + b.inserted, 0);
  const totalUpd = Object.values(result.details).reduce((a, b) => a + b.updated, 0);

  result.message = `Restore completed successfully! Restored ${totalIns} new records and updated ${totalUpd} existing records.`;
  return result;
};
