import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { getActiveCompanyId, safeSupabaseSave, toStorageValue } from './helpers';

export type EntityType = 
  | 'parties' 
  | 'customers' 
  | 'vendors' 
  | 'stock_items' 
  | 'sales_invoices' 
  | 'purchase_bills' 
  | 'cashbooks' 
  | 'duties_taxes';

export interface ValidationErrorItem {
  rowNumber: number;
  sheetName: string;
  field: string;
  message: string;
  rawValue?: any;
}

export interface EntityConflictItem {
  importedRowIndex: number;
  importedRow: any;
  matchType: 'id' | 'key';
  matchedExistingRecord: any;
  resolution: 'update' | 'skip' | 'create_new';
}

export interface EntityParsedData {
  entityType: EntityType;
  sheetName: string;
  headers: string[];
  totalRows: number;
  validRows: any[];
  invalidRows: ValidationErrorItem[];
  conflicts: EntityConflictItem[];
}

export interface MultiSheetImportResult {
  fileName: string;
  isMultiSheet: boolean;
  sheets: EntityParsedData[];
  totalRecordsFound: number;
  totalValid: number;
  totalInvalid: number;
  totalConflicts: number;
}

// Normalize strings for matching
const norm = (str: any) => String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Clean number parser
export const parseNumberSafe = (val: any, fallback = 0): number => {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'number') return isNaN(val) ? fallback : val;
  let str = String(val).trim();
  if (!str) return fallback;
  
  const isNeg = (str.startsWith('(') && str.endsWith(')')) || str.startsWith('-');
  str = str.replace(/[^0-9.]/g, '');
  const num = parseFloat(str);
  if (isNaN(num)) return fallback;
  return isNeg ? -num : num;
};

// Clean date parser handling Excel serials, ISO dates, DD/MM/YYYY, etc.
export const parseDateSafe = (val: any): string | null => {
  if (!val) return null;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return val.toISOString().split('T')[0];
  }

  // Excel serial number (e.g. 45000)
  if (typeof val === 'number' && val > 20000 && val < 70000) {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }

  const str = String(val).trim();
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Fallback to Date parser
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  return null;
};

// Aliases for header mapping
const HEADER_ALIASES: Record<EntityType, Record<string, string[]>> = {
  parties: {
    id: ['recordid', 'id', 'partyid', 'uuid'],
    name: ['partyname', 'name', 'customername', 'vendorname', 'party', 'accountname', 'ledger'],
    party_type: ['partytype', 'type', 'role', 'category'],
    gstin: ['gstin', 'gst', 'gstnumber', 'taxid', 'tin'],
    phone: ['phonenumber', 'phone', 'mobile', 'contact', 'cell', 'mobileno'],
    email: ['email', 'emailid', 'mail'],
    state: ['state', 'placeofsupply', 'region'],
    address: ['address', 'billingaddress', 'street', 'city', 'location'],
    pan: ['pan', 'panno', 'pannumber'],
    balance: ['openingbalance', 'balance', 'openingbal', 'due', 'amountdue'],
    account_number: ['bankaccount', 'accountnumber', 'accno', 'accountno'],
    ifsc_code: ['ifsccode', 'ifsc'],
    account_name: ['bankname', 'accountname']
  },
  customers: {
    id: ['recordid', 'id', 'customerid', 'uuid'],
    name: ['customername', 'name', 'customer', 'partyname', 'accountname'],
    party_type: ['partytype', 'type'],
    gstin: ['gstin', 'gst', 'gstnumber', 'taxid'],
    phone: ['phonenumber', 'phone', 'mobile', 'contact'],
    email: ['email', 'emailid', 'mail'],
    state: ['state', 'placeofsupply'],
    address: ['address', 'billingaddress'],
    pan: ['pan', 'panno'],
    balance: ['openingbalance', 'balance'],
    account_number: ['bankaccount', 'accountnumber'],
    ifsc_code: ['ifsccode', 'ifsc'],
    account_name: ['bankname', 'accountname']
  },
  vendors: {
    id: ['recordid', 'id', 'vendorid', 'uuid'],
    name: ['vendorname', 'name', 'vendor', 'supplier', 'partyname', 'accountname'],
    party_type: ['partytype', 'type'],
    gstin: ['gstin', 'gst', 'gstnumber', 'taxid'],
    phone: ['phonenumber', 'phone', 'mobile', 'contact'],
    email: ['email', 'emailid', 'mail'],
    state: ['state', 'placeofsupply'],
    address: ['address', 'billingaddress'],
    pan: ['pan', 'panno'],
    balance: ['openingbalance', 'balance'],
    account_number: ['bankaccount', 'accountnumber'],
    ifsc_code: ['ifsccode', 'ifsc'],
    account_name: ['bankname', 'accountname']
  },
  stock_items: {
    id: ['recordid', 'id', 'itemid', 'uuid'],
    name: ['itemname', 'name', 'productname', 'item', 'product', 'particulars'],
    hsn: ['hsnsac', 'hsn', 'sac', 'hsncode'],
    sku: ['sku', 'code', 'itemcode', 'productcode', 'barcode'],
    unit: ['unit', 'uom', 'measure'],
    category: ['category', 'group', 'family', 'itemgroup'],
    rate: ['purchaserate', 'rate', 'price', 'purchaseprice', 'costprice'],
    selling_price: ['sellingprice', 'saleprice', 'sellingrate'],
    in_stock: ['openingstock', 'stock', 'qty', 'quantity', 'instock'],
    tax_rate: ['taxrate', 'taxrate%', 'tax', 'gstrate'],
    description: ['description', 'desc', 'notes', 'details']
  },
  sales_invoices: {
    id: ['recordid', 'id', 'invoiceid', 'uuid'],
    invoice_number: ['invoicenumber', 'invoiceno', 'invoice#', 'invno', 'ref', 'billno', 'number'],
    date: ['date', 'invoicedate', 'entrydate', 'createdat', 'invdate'],
    customer_name: ['customername', 'customer', 'partyname', 'party', 'client', 'buyer'],
    total_without_gst: ['subtotal', 'totalwithoutgst', 'taxableamount', 'taxablevalue'],
    total_gst: ['totalgst', 'gstamount', 'gst', 'taxamount', 'tax'],
    round_off: ['roundoff', 'rounding'],
    grand_total: ['grandtotal', 'total', 'netamount', 'payable', 'invoiceamount', 'amount'],
    status: ['status', 'paymentstatus'],
    description: ['description', 'desc', 'notes', 'remarks'],
    items: ['lineitemsjson', 'itemsjson', 'items', 'lineitems', 'products']
  },
  purchase_bills: {
    id: ['recordid', 'id', 'billid', 'uuid'],
    bill_number: ['billnumber', 'billno', 'bill#', 'invoiceno', 'docno', 'ref', 'number'],
    date: ['date', 'billdate', 'entrydate', 'createdat'],
    vendor_name: ['vendorname', 'vendor', 'partyname', 'party', 'supplier', 'seller'],
    total_without_gst: ['subtotal', 'totalwithoutgst', 'taxableamount', 'taxablevalue'],
    total_gst: ['totalgst', 'gstamount', 'gst', 'taxamount', 'tax'],
    round_off: ['roundoff', 'rounding'],
    grand_total: ['grandtotal', 'total', 'netamount', 'payable', 'billamount', 'amount'],
    status: ['status', 'paymentstatus'],
    description: ['description', 'desc', 'notes', 'remarks'],
    items: ['lineitemsjson', 'itemsjson', 'items', 'lineitems', 'products']
  },
  cashbooks: {
    id: ['recordid', 'id', 'cashbookid', 'uuid'],
    date: ['date', 'entrydate', 'stmtdate', 'statementdate'],
    income_total: ['incometotal', 'income', 'totalinward', 'inward'],
    expense_total: ['expensetotal', 'expense', 'totaloutward', 'outward'],
    balance: ['netbalance', 'balance', 'closingbalance'],
    raw_data: ['entriesjson', 'rawdata', 'entries', 'items']
  },
  duties_taxes: {
    id: ['recordid', 'id', 'taxid', 'uuid'],
    name: ['taxname', 'name', 'charge', 'duty', 'particulars'],
    type: ['type', 'taxtype'],
    calc_method: ['calculationmethod', 'calcmethod', 'method'],
    rate: ['rate', 'rate%', 'percentage'],
    fixed_amount: ['fixedamount', 'fixedamt', 'amount'],
    apply_on: ['applyon', 'applyto'],
    applicable_to: ['applicableto', 'appliesto'],
    is_default: ['isdefault', 'default']
  }
};

/**
 * Detects entity type based on sheet name and row headers
 */
export const detectEntityType = (sheetName: string, headers: string[]): EntityType => {
  const normName = norm(sheetName);
  if (normName.includes('party') || normName.includes('parties')) return 'parties';
  if (normName.includes('customer')) return 'customers';
  if (normName.includes('vendor') || normName.includes('supplier')) return 'vendors';
  if (normName.includes('stock') || normName.includes('item') || normName.includes('inventory')) return 'stock_items';
  if (normName.includes('invoice') || normName.includes('sale')) return 'sales_invoices';
  if (normName.includes('bill') || normName.includes('purchase')) return 'purchase_bills';
  if (normName.includes('cashbook') || normName.includes('cash')) return 'cashbooks';
  if (normName.includes('tax') || normName.includes('charge') || normName.includes('duty')) return 'duties_taxes';

  // Fallback: match by header presence
  const normHeaders = headers.map(norm);
  if (normHeaders.some(h => h.includes('invoiceno') || h.includes('invoicenumber'))) return 'sales_invoices';
  if (normHeaders.some(h => h.includes('billno') || h.includes('billnumber'))) return 'purchase_bills';
  if (normHeaders.some(h => h.includes('incometotal') || h.includes('expensetotal'))) return 'cashbooks';
  if (normHeaders.some(h => h.includes('purchaserate') || h.includes('sellingprice'))) return 'stock_items';
  if (normHeaders.some(h => h.includes('calcmethod') || h.includes('applyon'))) return 'duties_taxes';
  if (normHeaders.some(h => h.includes('partytype') || h.includes('gstin'))) return 'parties';

  return 'parties';
};

/**
 * Fetches all existing database records for the company to perform conflict and relationship checks
 */
export const fetchCompanyExistingData = async (companyId: string) => {
  const [
    { data: customers },
    { data: vendors },
    { data: stockItems },
    { data: salesInvoices },
    { data: purchaseBills },
    { data: cashbooks },
    { data: dutiesTaxes }
  ] = await Promise.all([
    supabase.from('customers').select('*').eq('company_id', companyId).eq('is_deleted', false),
    supabase.from('vendors').select('*').eq('company_id', companyId).eq('is_deleted', false),
    supabase.from('stock_items').select('*').eq('company_id', companyId).eq('is_deleted', false),
    supabase.from('sales_invoices').select('*').eq('company_id', companyId).eq('is_deleted', false),
    supabase.from('purchase_bills').select('*').eq('company_id', companyId).eq('is_deleted', false),
    supabase.from('cashbooks').select('*').eq('company_id', companyId).eq('is_deleted', false),
    supabase.from('duties_taxes').select('*').eq('company_id', companyId).eq('is_deleted', false)
  ]);

  return {
    customers: customers || [],
    vendors: vendors || [],
    stock_items: stockItems || [],
    sales_invoices: salesInvoices || [],
    purchase_bills: purchaseBills || [],
    cashbooks: cashbooks || [],
    duties_taxes: dutiesTaxes || []
  };
};

/**
 * Maps a single row of cells into a typed entity object using header index mapping
 */
const mapRowToEntity = (
  rawRow: any[],
  colMap: Record<string, number>,
  entityType: EntityType,
  rowIndex: number,
  sheetName: string
): { item: any; errors: ValidationErrorItem[] } => {
  const errors: ValidationErrorItem[] = [];
  const getCellStr = (field: string): string => {
    const idx = colMap[field];
    if (idx === undefined || idx < 0 || idx >= rawRow.length) return '';
    return String(rawRow[idx] ?? '').trim();
  };
  const getCellNum = (field: string, fallback = 0): number => {
    const idx = colMap[field];
    if (idx === undefined || idx < 0 || idx >= rawRow.length) return fallback;
    return parseNumberSafe(rawRow[idx], fallback);
  };
  const getCellDate = (field: string): string | null => {
    const idx = colMap[field];
    if (idx === undefined || idx < 0 || idx >= rawRow.length) return null;
    return parseDateSafe(rawRow[idx]);
  };

  const recordId = getCellStr('id') || undefined;
  let item: any = { id: recordId };

  if (entityType === 'parties' || entityType === 'customers' || entityType === 'vendors') {
    const name = getCellStr('name');
    if (!name) {
      errors.push({ rowNumber: rowIndex, sheetName, field: 'Party Name', message: 'Party Name is required and cannot be empty.' });
    }

    let pType = getCellStr('party_type').toLowerCase();
    if (entityType === 'customers') pType = 'customer';
    else if (entityType === 'vendors') pType = 'vendor';
    else if (!pType) pType = 'customer';
    else if (pType.includes('both')) pType = 'both';
    else if (pType.includes('vend') || pType.includes('supp')) pType = 'vendor';
    else pType = 'customer';

    item = {
      ...item,
      name,
      party_type: pType,
      is_customer: pType === 'customer' || pType === 'both',
      gstin: getCellStr('gstin').toUpperCase(),
      phone: getCellStr('phone'),
      email: getCellStr('email'),
      state: getCellStr('state'),
      address: getCellStr('address'),
      pan: getCellStr('pan').toUpperCase(),
      balance: getCellNum('balance', 0),
      account_number: getCellStr('account_number'),
      ifsc_code: getCellStr('ifsc_code').toUpperCase(),
      account_name: getCellStr('account_name')
    };
  } else if (entityType === 'stock_items') {
    const name = getCellStr('name');
    if (!name) {
      errors.push({ rowNumber: rowIndex, sheetName, field: 'Item Name', message: 'Stock Item Name is required.' });
    }

    item = {
      ...item,
      name,
      hsn: getCellStr('hsn'),
      sku: getCellStr('sku'),
      unit: getCellStr('unit') || 'PCS',
      category: getCellStr('category') || 'General',
      rate: getCellNum('rate', 0),
      selling_price: getCellNum('selling_price', 0),
      in_stock: getCellNum('in_stock', 0),
      tax_rate: getCellNum('tax_rate', 18),
      description: getCellStr('description')
    };
  } else if (entityType === 'sales_invoices') {
    const invNo = getCellStr('invoice_number');
    const cust = getCellStr('customer_name');
    const dateStr = getCellDate('date');
    const grandTotal = getCellNum('grand_total', 0);

    if (!invNo) errors.push({ rowNumber: rowIndex, sheetName, field: 'Invoice Number', message: 'Invoice Number is required.' });
    if (!cust) errors.push({ rowNumber: rowIndex, sheetName, field: 'Customer Name', message: 'Customer Name is required.' });
    if (!dateStr) errors.push({ rowNumber: rowIndex, sheetName, field: 'Date', message: 'Valid Date (YYYY-MM-DD) is required.' });

    let itemsArray: any[] = [];
    const itemsRaw = getCellStr('items');
    if (itemsRaw) {
      try { itemsArray = JSON.parse(itemsRaw); } catch (_) { itemsArray = []; }
    }

    item = {
      ...item,
      invoice_number: invNo,
      customer_name: cust,
      date: dateStr || new Date().toISOString().split('T')[0],
      total_without_gst: getCellNum('total_without_gst', 0),
      total_gst: getCellNum('total_gst', 0),
      round_off: getCellNum('round_off', 0),
      grand_total: grandTotal,
      status: getCellStr('status') || 'Pending',
      description: getCellStr('description'),
      items: itemsArray
    };
  } else if (entityType === 'purchase_bills') {
    const billNo = getCellStr('bill_number');
    const vendor = getCellStr('vendor_name');
    const dateStr = getCellDate('date');
    const grandTotal = getCellNum('grand_total', 0);

    if (!billNo) errors.push({ rowNumber: rowIndex, sheetName, field: 'Bill Number', message: 'Bill Number is required.' });
    if (!vendor) errors.push({ rowNumber: rowIndex, sheetName, field: 'Vendor Name', message: 'Vendor Name is required.' });
    if (!dateStr) errors.push({ rowNumber: rowIndex, sheetName, field: 'Date', message: 'Valid Date (YYYY-MM-DD) is required.' });

    let itemsArray: any[] = [];
    const itemsRaw = getCellStr('items');
    if (itemsRaw) {
      try { itemsArray = JSON.parse(itemsRaw); } catch (_) { itemsArray = []; }
    }

    item = {
      ...item,
      bill_number: billNo,
      vendor_name: vendor,
      date: dateStr || new Date().toISOString().split('T')[0],
      total_without_gst: getCellNum('total_without_gst', 0),
      total_gst: getCellNum('total_gst', 0),
      round_off: getCellNum('round_off', 0),
      grand_total: grandTotal,
      status: getCellStr('status') || 'Pending',
      description: getCellStr('description'),
      items: itemsArray
    };
  } else if (entityType === 'cashbooks') {
    const dateStr = getCellDate('date');
    if (!dateStr) errors.push({ rowNumber: rowIndex, sheetName, field: 'Date', message: 'Date is required for Cashbook statement.' });

    let rawData: any = {};
    const rawDataStr = getCellStr('raw_data');
    if (rawDataStr) {
      try { rawData = JSON.parse(rawDataStr); } catch (_) { rawData = {}; }
    }

    item = {
      ...item,
      date: dateStr || new Date().toISOString().split('T')[0],
      income_total: getCellNum('income_total', 0),
      expense_total: getCellNum('expense_total', 0),
      balance: getCellNum('balance', 0),
      raw_data: rawData
    };
  } else if (entityType === 'duties_taxes') {
    const name = getCellStr('name');
    if (!name) errors.push({ rowNumber: rowIndex, sheetName, field: 'Tax Name', message: 'Tax / Charge Name is required.' });

    const defRaw = getCellStr('is_default').toLowerCase();
    item = {
      ...item,
      name,
      type: getCellStr('type') || 'Charge',
      calc_method: getCellStr('calc_method') || 'Percentage',
      rate: getCellNum('rate', 0),
      fixed_amount: getCellNum('fixed_amount', 0),
      apply_on: getCellStr('apply_on') || 'Subtotal',
      applicable_to: getCellStr('applicable_to') || 'Both',
      is_default: defRaw === 'yes' || defRaw === 'true' || defRaw === '1'
    };
  }

  return { item, errors };
};

/**
 * Detects header column mapping for an entity type
 */
const detectColumnMapping = (headerRow: any[], entityType: EntityType): Record<string, number> => {
  const aliases = HEADER_ALIASES[entityType] || {};
  const colMap: Record<string, number> = {};

  headerRow.forEach((cell, colIdx) => {
    const cellNorm = norm(cell);
    if (!cellNorm) return;

    for (const [field, aliasList] of Object.entries(aliases)) {
      if (colMap[field] !== undefined) continue;
      if (aliasList.some(a => cellNorm === a || cellNorm.includes(a))) {
        colMap[field] = colIdx;
      }
    }
  });

  return colMap;
};

/**
 * Primary workbook parser: parses single-sheet or multi-sheet workbooks
 * validates columns, types, relationships, and identifies conflicts.
 */
export const parseAndValidateWorkbook = async (
  file: File,
  forcedEntityType?: EntityType
): Promise<MultiSheetImportResult> => {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
  const cid = getActiveCompanyId();
  const existingData = cid ? await fetchCompanyExistingData(cid) : null;

  const result: MultiSheetImportResult = {
    fileName: file.name,
    isMultiSheet: workbook.SheetNames.length > 1,
    sheets: [],
    totalRecordsFound: 0,
    totalValid: 0,
    totalInvalid: 0,
    totalConflicts: 0
  };

  for (const sheetName of workbook.SheetNames) {
    // Skip metadata / internal sheets
    if (sheetName.startsWith('_') || sheetName.toLowerCase().includes('metadata')) {
      continue;
    }

    // Avoid duplicate parsing if workbook has both unified 'Parties' and separate 'Customers'/'Vendors'
    const hasPartiesSheet = workbook.SheetNames.some(s => {
      const l = s.toLowerCase();
      return l.includes('partie') || l === 'parties' || l === 'party';
    });
    const isCustOrVendSheet = sheetName.toLowerCase().includes('customer') || sheetName.toLowerCase().includes('vendor');
    if (hasPartiesSheet && isCustOrVendSheet && !sheetName.toLowerCase().includes('partie')) {
      continue;
    }

    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][];
    if (!rawRows || rawRows.length < 2) continue;

    // Detect header row (first non-empty row)
    let headerIdx = 0;
    for (let i = 0; i < Math.min(rawRows.length, 5); i++) {
      if (rawRows[i] && rawRows[i].some(c => String(c).trim() !== '')) {
        headerIdx = i;
        break;
      }
    }

    const headerRow = rawRows[headerIdx] || [];
    const headers = headerRow.map(c => String(c || '').trim()).filter(Boolean);
    const entityType = forcedEntityType || detectEntityType(sheetName, headers);
    const colMap = detectColumnMapping(headerRow, entityType);

    const validRows: any[] = [];
    const invalidRows: ValidationErrorItem[] = [];
    const conflicts: EntityConflictItem[] = [];

    // Track intra-file keys for duplicate detection within same sheet
    const seenIntraFileKeys = new Set<string>();

    for (let r = headerIdx + 1; r < rawRows.length; r++) {
      const row = rawRows[r];
      // Skip empty rows
      if (!row || row.every(c => c === null || c === undefined || String(c).trim() === '')) {
        continue;
      }

      const { item, errors } = mapRowToEntity(row, colMap, entityType, r + 1, sheetName);

      if (errors.length > 0) {
        invalidRows.push(...errors);
        continue;
      }

      // Check intra-file duplicate
      let intraKey = '';
      if (entityType === 'sales_invoices') intraKey = `inv_${item.invoice_number}`;
      else if (entityType === 'purchase_bills') intraKey = `bill_${item.bill_number}`;
      else if (entityType === 'parties' || entityType === 'customers' || entityType === 'vendors') intraKey = `party_${item.name}`;
      else if (entityType === 'stock_items') intraKey = `item_${item.name}`;
      else if (entityType === 'cashbooks') intraKey = `cb_${item.date}`;
      else if (entityType === 'duties_taxes') intraKey = `tax_${item.name}`;

      if (intraKey && seenIntraFileKeys.has(intraKey)) {
        invalidRows.push({
          rowNumber: r + 1,
          sheetName,
          field: 'Duplicate in File',
          message: `Duplicate record within the same file for key "${intraKey}".`
        });
        continue;
      }
      if (intraKey) seenIntraFileKeys.add(intraKey);

      // Check conflict with existing database records
      if (existingData) {
        let matchedRecord: any = null;
        let matchType: 'id' | 'key' = 'key';

        if (entityType === 'parties' || entityType === 'customers' || entityType === 'vendors') {
          const pool = [...existingData.customers, ...existingData.vendors];
          if (item.id) {
            matchedRecord = pool.find((p: any) => p.id === item.id);
            if (matchedRecord) matchType = 'id';
          }
          if (!matchedRecord) {
            matchedRecord = pool.find((p: any) => 
              (norm(p.name) === norm(item.name) && norm(item.name).length > 1) ||
              (item.gstin && norm(p.gstin) === norm(item.gstin) && norm(item.gstin).length >= 10)
            );
          }
        } else if (entityType === 'stock_items') {
          if (item.id) {
            matchedRecord = existingData.stock_items.find((i: any) => i.id === item.id);
            if (matchedRecord) matchType = 'id';
          }
          if (!matchedRecord) {
            matchedRecord = existingData.stock_items.find((i: any) => norm(i.name) === norm(item.name));
          }
        } else if (entityType === 'sales_invoices') {
          if (item.id) {
            matchedRecord = existingData.sales_invoices.find((i: any) => i.id === item.id);
            if (matchedRecord) matchType = 'id';
          }
          if (!matchedRecord) {
            matchedRecord = existingData.sales_invoices.find((i: any) => norm(i.invoice_number) === norm(item.invoice_number));
          }
        } else if (entityType === 'purchase_bills') {
          if (item.id) {
            matchedRecord = existingData.purchase_bills.find((b: any) => b.id === item.id);
            if (matchedRecord) matchType = 'id';
          }
          if (!matchedRecord) {
            matchedRecord = existingData.purchase_bills.find((b: any) => norm(b.bill_number) === norm(item.bill_number));
          }
        } else if (entityType === 'cashbooks') {
          if (item.id) {
            matchedRecord = existingData.cashbooks.find((c: any) => c.id === item.id);
            if (matchedRecord) matchType = 'id';
          }
          if (!matchedRecord) {
            matchedRecord = existingData.cashbooks.find((c: any) => c.date === item.date);
          }
        } else if (entityType === 'duties_taxes') {
          if (item.id) {
            matchedRecord = existingData.duties_taxes.find((t: any) => t.id === item.id);
            if (matchedRecord) matchType = 'id';
          }
          if (!matchedRecord) {
            matchedRecord = existingData.duties_taxes.find((t: any) => norm(t.name) === norm(item.name));
          }
        }

        if (matchedRecord) {
          conflicts.push({
            importedRowIndex: validRows.length,
            importedRow: item,
            matchType,
            matchedExistingRecord: matchedRecord,
            resolution: 'update' // Default to update existing
          });
        }
      }

      validRows.push(item);
    }

    const totalInSheet = validRows.length + invalidRows.length;
    result.totalRecordsFound += totalInSheet;
    result.totalValid += validRows.length;
    result.totalInvalid += invalidRows.length;
    result.totalConflicts += conflicts.length;

    result.sheets.push({
      entityType,
      sheetName,
      headers,
      totalRows: totalInSheet,
      validRows,
      invalidRows,
      conflicts
    });
  }

  return result;
};

/**
 * Saves all validated and confirmed rows to Supabase respecting user conflict resolution
 */
export const executeImportBatch = async (
  sheets: EntityParsedData[],
  targetCompanyId?: string
): Promise<{ success: boolean; created: number; updated: number; skipped: number; errors: string[] }> => {
  const cid = targetCompanyId || getActiveCompanyId();
  if (!cid) throw new Error("No active workspace selected for import.");

  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  const errors: string[] = [];

  for (const sheetData of sheets) {
    const { entityType, validRows, conflicts } = sheetData;
    const conflictMap = new Map<number, EntityConflictItem>();
    conflicts.forEach(c => conflictMap.set(c.importedRowIndex, c));

    let defaultTableName: string = 'vendors';
    if (entityType === 'stock_items') defaultTableName = 'stock_items';
    else if (entityType === 'sales_invoices') defaultTableName = 'sales_invoices';
    else if (entityType === 'purchase_bills') defaultTableName = 'purchase_bills';
    else if (entityType === 'cashbooks') defaultTableName = 'cashbooks';
    else if (entityType === 'duties_taxes') defaultTableName = 'duties_taxes';
    else if (entityType === 'customers') defaultTableName = 'customers';
    else if (entityType === 'vendors') defaultTableName = 'vendors';

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      const conflict = conflictMap.get(i);

      if (conflict && conflict.resolution === 'skip') {
        skippedCount++;
        continue;
      }

      // Determine target table dynamically for parties
      let targetTable = defaultTableName;
      if (entityType === 'parties') {
        const isCust = row.party_type === 'customer' || row.is_customer;
        targetTable = isCust ? 'customers' : 'vendors';
      }

      try {
        const payload = { ...row, company_id: cid, is_deleted: false };
        const isUpdate = conflict && conflict.resolution === 'update';
        const targetId = isUpdate ? (conflict.matchedExistingRecord?.id || row.id) : undefined;

        if (isUpdate && targetId) {
          delete payload.id;
          const { error } = await supabase
            .from(targetTable)
            .update(payload)
            .eq('id', targetId)
            .eq('company_id', cid);
          if (error) throw error;
          updatedCount++;
        } else {
          // If row has an ID but we are creating new, or if ID is not a UUID, let DB generate or use UUID
          const isUuid = typeof payload.id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.id);
          if (!isUuid || conflict?.resolution === 'create_new') {
            delete payload.id;
          }
          const { error } = await supabase
            .from(targetTable)
            .insert([payload]);
          if (error) throw error;
          createdCount++;
        }
      } catch (err: any) {
        errors.push(`${entityType} row import error: ${err.message || 'Save failed'}`);
      }
    }
  }

  // Refresh application state
  window.dispatchEvent(new Event('partiesUpdated'));
  window.dispatchEvent(new Event('stockUpdated'));
  window.dispatchEvent(new Event('salesUpdated'));
  window.dispatchEvent(new Event('billsUpdated'));
  window.dispatchEvent(new Event('appSettingsChanged'));

  return {
    success: errors.length === 0,
    created: createdCount,
    updated: updatedCount,
    skipped: skippedCount,
    errors
  };
};
