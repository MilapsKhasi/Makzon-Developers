
import { supabase } from '../lib/supabase';

export const CURRENCIES = {
  INR: { symbol: '₹', name: 'Indian Rupee', locale: 'en-IN' },
  USD: { symbol: '$', name: 'US Dollar', locale: 'en-US' }
};

export const getActiveCompanyId = () => localStorage.getItem('activeCompanyId') || '';

export const getAppSettings = () => {
  const cid = getActiveCompanyId();
  const s = localStorage.getItem(`appSettings_${cid}`);
  try {
    return s ? JSON.parse(s) : { currency: 'INR', dateFormat: 'DD/MM/YYYY' };
  } catch (e) {
    return { currency: 'INR', dateFormat: 'DD/MM/YYYY' };
  }
};

export const saveAppSettings = (settings: any) => {
  const cid = getActiveCompanyId();
  localStorage.setItem(`appSettings_${cid}`, JSON.stringify(settings));
};

export const formatCurrency = (amount: number | undefined | null) => {
  if (amount === undefined || amount === null || isNaN(amount)) return '';
  const { currency } = getAppSettings();
  const config = CURRENCIES[currency as keyof typeof CURRENCIES] || CURRENCIES.INR;
  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2
  }).format(amount);
};

export const formatDate = (iso: any) => {
  if (!iso || typeof iso !== 'string') return '';
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  const [y, m, d] = parts;
  return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
};

export const formatDateShort = (iso: any) => {
  if (!iso || typeof iso !== 'string') return '';
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  const [y, m, d] = parts;
  return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y.slice(-2)}`;
};

export const parseDateFromInput = (input: string): string | null => {
  if (!input) return null;
  const parts = input.split(/[\/\-\.]/);
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
  if (dateObj.getFullYear() < 1000) return null;

  return iso;
};

export const getDatePlaceholder = () => 'DD/MM/YY';

export const toDisplayValue = (value: any) => {
  const num = parseFloat(value);
  return isNaN(num) ? 0 : num;
};

export const toStorageValue = (value: any) => {
  const num = parseFloat(value);
  return isNaN(num) ? 0 : num;
};

/**
 * Enhanced Save utility that silently handles missing DB columns by stripping them.
 */
export const safeSupabaseSave = async (table: string, payload: any, id?: string): Promise<any> => {
  const operation = id 
    ? supabase.from(table).update(payload).eq('id', id).select()
    : supabase.from(table).insert([payload]).select();
  
  const res = await operation;

  if (res.error) {
    const msg = res.error.message.toLowerCase();
    if (msg.includes("column") && (msg.includes("not found") || msg.includes("does not exist") || msg.includes("schema cache"))) {
      const missingColumnMatch = msg.match(/column ['"](.+?)['"] of/i) || 
                                 msg.match(/['"](.+?)['"] column/i) || 
                                 msg.match(/find the ['"](.+?)['"] column/i) ||
                                 msg.match(/column ['"](.+?)['"] does not exist/i);
      
      if (missingColumnMatch) {
        const offendingColumn = missingColumnMatch[1];
        if (offendingColumn && payload.hasOwnProperty(offendingColumn)) {
          const nextPayload = { ...payload }; 
          delete nextPayload[offendingColumn]; 
          return safeSupabaseSave(table, nextPayload, id);
        }
      }
    }
    throw res.error;
  }
  return res;
};

/**
 * Normalizes a bill record by extracting metadata (type, gstin, etc) 
 * from the items JSON if the top-level columns are missing.
 */
export const normalizeBill = (bill: any) => {
    const itemsData = bill.items;
    let type = bill.transaction_type || bill.type;
    let gst_type = bill.gst_type;
    let round_off = bill.round_off;
    let line_items = Array.isArray(itemsData) ? itemsData : [];

    if (itemsData && !Array.isArray(itemsData) && itemsData.line_items) {
        line_items = itemsData.line_items;
        type = type || itemsData.transaction_type || itemsData.type;
        gst_type = gst_type || itemsData.gst_type;
        round_off = round_off || itemsData.round_off;
    }

    const normalizedTypeStr = type?.toLowerCase();
    if (normalizedTypeStr === 'sale' || normalizedTypeStr === 'sales') type = 'Sale';
    else if (normalizedTypeStr === 'purchase' || normalizedTypeStr === 'purchases') type = 'Purchase';
    else type = 'Purchase'; 

    return {
        ...bill,
        type: type, 
        transaction_type: type.toLowerCase(),
        gst_type: gst_type || 'Intra-State',
        round_off: Number(round_off) || 0,
        items: line_items
    };
};

/**
 * Ensures items from a bill are registered in the stock master (stock_items table)
 */
export const ensureStockItems = async (items: any[], company_id: string, user_id: string) => {
  if (!items || !Array.isArray(items)) return;
  
  for (const item of items) {
    const itemName = item.itemName?.trim();
    if (!itemName) continue;
    
    const { data: existing } = await supabase
      .from('stock_items')
      .select('id, name, in_stock')
      .eq('company_id', company_id)
      .eq('name', itemName)
      .eq('is_deleted', false)
      .maybeSingle();

    const payload: any = {
      name: itemName,
      hsn: item.hsnCode || '',
      rate: Number(item.rate) || 0,
      tax_rate: Number(item.tax_rate) || 0,
      unit: item.unit || 'PCS',
      kg_per_bag: Number(item.kgPerBag) || 0,
      company_id,
      user_id,
      is_deleted: false
    };

    if (existing) {
      // Update master with latest transaction metadata (HSN, Rate etc)
      await supabase.from('stock_items').update(payload).eq('id', existing.id);
    } else {
      // Initialize new item in master
      await supabase.from('stock_items').insert([{ ...payload, in_stock: 0 }]);
    }
  }
};

/**
 * Ensures a party (Customer or Vendor) is registered in the party table (vendors table)
 */
export const ensureParty = async (name: string, type: 'customer' | 'vendor', company_id: string, user_id: string) => {
  if (!name || !name.trim()) return;
  
  const { data: existing } = await supabase
    .from('vendors')
    .select('*')
    .eq('company_id', company_id)
    .eq('name', name.trim())
    .eq('is_deleted', false)
    .maybeSingle();

  if (!existing) {
    const payload = {
      name: name.trim(),
      party_type: type,
      is_customer: type === 'customer',
      company_id,
      user_id,
      is_deleted: false,
      balance: 0
    };
    await safeSupabaseSave('vendors', payload);
  } else {
    const updates: any = {};
    if (type === 'customer' && !existing.is_customer && existing.party_type !== 'customer') {
        updates.is_customer = true;
        updates.party_type = 'customer';
    } else if (type === 'vendor' && existing.is_customer !== false && existing.party_type !== 'vendor') {
        updates.is_customer = false;
        updates.party_type = 'vendor';
    }

    if (Object.keys(updates).length > 0) {
        await safeSupabaseSave('vendors', updates, existing.id);
    }
  }
};

/**
 * Automatically syncs a Paid transaction to the Daily Cashbook
 */
export const syncTransactionToCashbook = async (transaction: any) => {
  const bill = normalizeBill(transaction);
  const { company_id, date, vendor_name, bill_number, grand_total, type, status } = bill;
  
  if (status !== 'Paid') return;

  try {
    const { data: existing } = await supabase
      .from('cashbooks')
      .select('*')
      .eq('company_id', company_id)
      .eq('date', date)
      .eq('is_deleted', false)
      .maybeSingle();

    const isSale = type === 'Sale';
    const entryLabel = `${isSale ? 'Sales' : 'Purchase'} - Bill ${bill_number} - ${vendor_name}`;
    const amount = Number(grand_total) || 0;

    let incomeRows = [];
    let expenseRows = [];
    let cashbookId = null;

    if (existing) {
      cashbookId = existing.id;
      const raw = existing.raw_data || {};
      incomeRows = Array.isArray(raw.incomeRows) ? raw.incomeRows : [];
      expenseRows = Array.isArray(raw.expenseRows) ? raw.expenseRows : [];
      
      const alreadyIn = [...incomeRows, ...expenseRows].some(r => r.particulars?.includes(`Bill ${bill_number}`));
      if (alreadyIn) return; 
    }

    const newRow = { 
      id: Math.random().toString(36).substr(2, 9), 
      particulars: entryLabel, 
      amount: amount.toString() 
    };

    if (isSale) incomeRows.push(newRow);
    else expenseRows.push(newRow);

    const cleanIncome = incomeRows.filter(r => r.particulars.trim() !== '');
    const cleanExpense = expenseRows.filter(r => r.particulars.trim() !== '');

    const incomeTotal = cleanIncome.reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
    const expenseTotal = cleanExpense.reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
    
    const payload = {
      company_id,
      date,
      income_total: incomeTotal,
      expense_total: expenseTotal,
      balance: incomeTotal - expenseTotal, 
      raw_data: {
        incomeRows: cleanIncome,
        expenseRows: cleanExpense,
        date,
        incomeTotal,
        expenseTotal
      },
      is_deleted: false
    };

    if (cashbookId) {
      await supabase.from('cashbooks').update(payload).eq('id', cashbookId);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('cashbooks').insert([{ ...payload, user_id: user?.id }]);
    }
  } catch (err) {
    console.error("Cashbook Sync Error:", err);
  }
};

export const getSelectedLedgerIds = () => {
    const cid = getActiveCompanyId();
    try {
      return JSON.parse(localStorage.getItem(`selectedLedgers_${cid}`) || '[]');
    } catch {
      return [];
    }
};

export const toggleSelectedLedgerId = (ledgerId: string) => {
    const cid = getActiveCompanyId();
    const current = getSelectedLedgerIds();
    const next = current.includes(ledgerId) 
        ? current.filter((id: string) => id !== ledgerId)
        : [...current, ledgerId];
    localStorage.setItem(`selectedLedgers_${cid}`, JSON.stringify(next));
    return next;
};
