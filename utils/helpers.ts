
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

export const parseDateFromInput = (input: string): string | null => {
  if (!input) return null;
  const parts = input.split(/[\/\-\.]/);
  if (parts.length !== 3) return null;
  let [d, m, y] = parts;
  if (y.length === 2) {
    const currentYearPrefix = new Date().getFullYear().toString().slice(0, 2);
    y = currentYearPrefix + y;
  }
  const iso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  const dateObj = new Date(iso);
  return isNaN(dateObj.getTime()) ? null : iso;
};

export const getDatePlaceholder = () => 'DD/MM/YYYY';

export const toDisplayValue = (value: any) => {
  const num = parseFloat(value);
  return isNaN(num) ? 0 : num;
};

export const toStorageValue = (value: any) => {
  const num = parseFloat(value);
  return isNaN(num) ? 0 : num;
};

/**
 * Smart save utility that strips columns not present in the DB schema.
 * Prevents "Column not found" errors during schema mismatches.
 */
export const safeSupabaseSave = async (table: string, payload: any, id?: string): Promise<any> => {
  const operation = id 
    ? supabase.from(table).update(payload).eq('id', id).select()
    : supabase.from(table).insert([payload]).select();
  
  const res = await operation;

  if (res.error) {
    const msg = res.error.message.toLowerCase();
    // Broaden matching for different database/PostgREST error messages
    if (msg.includes("column") && (msg.includes("not found") || msg.includes("does not exist") || msg.includes("schema cache"))) {
      const missingColumnMatch = msg.match(/column ['"](.+?)['"] of/i) || 
                                 msg.match(/['"](.+?)['"] column/i) || 
                                 msg.match(/find the ['"](.+?)['"] column/i) ||
                                 msg.match(/column ['"](.+?)['"] does not exist/i);
      
      if (missingColumnMatch) {
        const offendingColumn = missingColumnMatch[1];
        if (offendingColumn && payload.hasOwnProperty(offendingColumn)) {
          console.warn(`SafeSave: Stripping missing column '${offendingColumn}' from ${table} payload.`);
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
