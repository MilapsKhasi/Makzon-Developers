
import { supabase } from '../lib/supabase';

export const CURRENCIES = {
  INR: { symbol: '₹', name: 'Indian Rupee', locale: 'en-IN' },
  USD: { symbol: '$', name: 'US Dollar', locale: 'en-US' }
};

export const getActiveCompanyId = () => {
  const id = localStorage.getItem('activeCompanyId');
  return id && id !== 'undefined' ? id : '';
};

export const getAppSettings = () => {
  const cid = getActiveCompanyId();
  const defaultSettings = { 
    currency: 'INR', 
    borderStyle: 'rounded', 
    dateFormat: 'DD/MM/YYYY',
    gstEnabled: false,
    gstType: 'CGST - SGST'
  };
  
  if (!cid) return defaultSettings;
  
  const s = localStorage.getItem(`appSettings_${cid}`);
  try {
    return s ? { ...defaultSettings, ...JSON.parse(s) } : defaultSettings;
  } catch (e) {
    return defaultSettings;
  }
};

export const formatCurrency = (amount: number | undefined | null, includeSymbol: boolean = true) => {
  if (amount === undefined || amount === null || isNaN(amount)) return includeSymbol ? '₹ 0.00' : '0.00';
  const { currency } = getAppSettings();
  const config = CURRENCIES[currency as keyof typeof CURRENCIES] || CURRENCIES.INR;
  
  const options: any = {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  };
  
  if (includeSymbol) {
    options.style = 'currency';
    options.currency = currency;
  } else {
    options.style = 'decimal';
  }
  
  return new Intl.NumberFormat(config.locale, options).format(amount);
};

export const formatDate = (iso: any) => {
  if (!iso || typeof iso !== 'string') return '';
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  const [y, m, d] = parts;
  return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
};

export const parseDateFromInput = (input: string): string | null => {
  if (!input) return null;
  const parts = input.split(/[\/\-.]/);
  if (parts.length !== 3) return null;
  let [d, m, y] = parts;
  if (y.length === 2) {
    const yearNum = parseInt(y);
    const prefix = yearNum < 50 ? "20" : "19";
    y = prefix + y;
  }
  const iso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  const dateObj = new Date(iso);
  if (isNaN(dateObj.getTime())) return null;
  return iso;
};

export const toDisplayValue = (val: any) => {
  return val === null || val === undefined ? '' : val;
};

export const toStorageValue = (val: any) => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const num = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
  return isNaN(num) ? 0 : num;
};

export const safeSupabaseSave = async (table: string, payload: any, id?: string): Promise<any> => {
  const cid = getActiveCompanyId();
  if (!cid && table !== 'companies' && table !== 'profiles') {
    throw new Error("No active workspace context.");
  }

  let cleanPayload: any = { ...payload };
  if (table !== 'companies' && table !== 'profiles') {
    cleanPayload.company_id = cid;
  }

  const ghostColumns = [
    'type',
    'gst_type',
    'transaction_type', 
    'user_id', 
    'items_raw', 
    'displayDate'
  ];
  
  ghostColumns.forEach(col => delete cleanPayload[col]);

  const operation = id
    ? supabase.from(table).update(cleanPayload).eq('id', id).select()
    : supabase.from(table).insert([cleanPayload]).select();

  const res = await operation;
  if (res.error) throw res.error;
  return res;
};

export const normalizeBill = (data: any) => {
  if (!data) return null;
  const isSale = data.customer_name !== undefined || data.invoice_number !== undefined;
  const partyName = data.customer_name || data.vendor_name || 'Unknown';
  const docNumber = data.invoice_number || data.bill_number || 'N/A';
  const itemsRaw = data.items || {};
  let line_items = [];
  let gstType = 'Intra-State';

  if (Array.isArray(itemsRaw)) {
    line_items = itemsRaw;
  } else if (typeof itemsRaw === 'object') {
    line_items = itemsRaw.line_items || [];
    gstType = itemsRaw.gst_type || 'Intra-State'; 
  }

  return {
    ...data,
    type: isSale ? 'Sale' : 'Purchase',
    vendor_name: partyName, 
    customer_name: partyName, 
    bill_number: docNumber, 
    invoice_number: docNumber,
    gst_type: gstType,
    items: line_items,
    items_raw: itemsRaw                  
  };
};

export const getSelectedLedgerIds = () => {
  const cid = getActiveCompanyId();
  if (!cid) return [];
  try { return JSON.parse(localStorage.getItem(`selectedLedgers_${cid}`) || '[]'); } catch { return []; }
};

export const toggleSelectedLedgerId = (ledgerId: string) => {
  const cid = getActiveCompanyId();
  if (!cid) return [];
  const current = getSelectedLedgerIds();
  const next = current.includes(ledgerId) ? current.filter((id: string) => id !== ledgerId) : [...current, ledgerId];
  localStorage.setItem(`selectedLedgers_${cid}`, JSON.stringify(next));
  return next;
};

export const ensureStockItems = async (items: any[], company_id: string) => {
  if (!items || !Array.isArray(items)) return;
  for (const item of items) {
    const itemName = item.itemName?.trim();
    if (!itemName) continue;
    const { data: existing } = await supabase.from('stock_items').select('id').eq('company_id', company_id).eq('name', itemName).eq('is_deleted', false).maybeSingle();
    const payload: any = {
      name: itemName,
      hsn: item.hsnCode || '',
      rate: Number(item.rate) || 0,
      tax_rate: Number(item.tax_rate) || 0,
      unit: item.unit || 'PCS',
      company_id,
      is_deleted: false
    };
    if (existing) await supabase.from('stock_items').update(payload).eq('id', existing.id);
    else await supabase.from('stock_items').insert([{ ...payload, in_stock: 0 }]);
  }
};

export const ensureParty = async (name: string, type: 'customer' | 'vendor', company_id: string) => {
  if (!name || !name.trim()) return;
  const { data: existing } = await supabase.from('vendors').select('*').eq('company_id', company_id).eq('name', name.trim()).eq('is_deleted', false).maybeSingle();
  if (!existing) {
    const payload = {
      name: name.trim(),
      party_type: type,
      is_customer: type === 'customer',
      company_id,
      is_deleted: false,
      balance: 0
    };
    await safeSupabaseSave('vendors', payload);
  }
};

export const syncTransactionToCashbook = async (transaction: any) => {
  const bill = normalizeBill(transaction);
  if (!bill) return;
  const { company_id, date, vendor_name, bill_number, grand_total, type, status } = bill;
  if (status !== 'Paid') return;
  try {
    const { data: existing } = await supabase.from('cashbooks').select('*').eq('company_id', company_id).eq('date', date).eq('is_deleted', false).maybeSingle();
    const isSale = type === 'Sale';
    const entryLabel = `${isSale ? 'Sales' : 'Purchase'} - Bill ${bill_number} - ${vendor_name}`;
    const amount = Number(grand_total) || 0;
    let incomeRows = []; let expenseRows = []; let cashbookId = null;
    if (existing) {
      cashbookId = existing.id;
      const raw = existing.raw_data || {};
      incomeRows = Array.isArray(raw.incomeRows) ? raw.incomeRows : [];
      expenseRows = Array.isArray(raw.expenseRows) ? raw.expenseRows : [];
      const alreadyIn = [...incomeRows, ...expenseRows].some(r => r.particulars?.includes(`Bill ${bill_number}`));
      if (alreadyIn) return;
    }
    const newRow = { id: Math.random().toString(36).substr(2, 9), particulars: entryLabel, amount: amount.toString() };
    if (isSale) incomeRows.push(newRow); else expenseRows.push(newRow);
    const payload = {
      company_id, date,
      income_total: incomeRows.reduce((acc, r) => acc + (Number(r.amount) || 0), 0),
      expense_total: expenseRows.reduce((acc, r) => acc + (Number(r.amount) || 0), 0),
      balance: incomeRows.reduce((acc, r) => acc + (Number(r.amount) || 0), 0) - expenseRows.reduce((acc, r) => acc + (Number(r.amount) || 0), 0),
      raw_data: { incomeRows, expenseRows, date },
      is_deleted: false
    };
    if (cashbookId) await supabase.from('cashbooks').update(payload).eq('id', cashbookId);
    else await supabase.from('cashbooks').insert([payload]);
  } catch (err) { console.error("Cashbook Sync Error:", err); }
};
