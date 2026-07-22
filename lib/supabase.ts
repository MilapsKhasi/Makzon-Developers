import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL || 'https://blbaolnlzohguwqiyflg.supabase.co';
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsYmFvbG5sem9oZ3V3cWl5ZmxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxMjY2ODgsImV4cCI6MjA4MzcwMjY4OH0.nGCG_M3-m2hNnP8Nu0aftZ1Ug0OheU5GmbGNr-Iwxxg';

const supabaseUrl = rawUrl.trim().replace(/['"]/g, '');
const supabaseAnonKey = rawKey.trim().replace(/['"]/g, '');

const finalUrl = supabaseUrl.startsWith('http') ? supabaseUrl : `https://${supabaseUrl}`;

export const realSupabase = createClient(finalUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  global: {
    fetch: (...args) => fetch(...args)
  }
});

function isNetworkError(err: any): boolean {
  if (!err) return false;
  const msg = typeof err === 'string' ? err : (err.message || err.details || err.toString() || '');
  const lower = msg.toLowerCase();
  return (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('network request failed') ||
    lower.includes('fetch failed') ||
    err.name === 'TypeError'
  );
}

function enableOfflineMode() {
  if (typeof window !== 'undefined') {
    localStorage.setItem('use_offline_mode', 'true');
    seedLocalStorage();
  }
}

// --- Mock Offline Supabase Client ---
class MockBuilder {
  table: string;
  filters: Array<(item: any) => boolean> = [];
  orderByField: string | null = null;
  orderAscending: boolean = true;
  limitNum: number | null = null;
  isHead: boolean = false;
  pendingOp: (() => any) | null = null;

  constructor(table: string) {
    this.table = table;
  }

  getItems() {
    const key = `local_db_${this.table}`;
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  saveItems(items: any[]) {
    const key = `local_db_${this.table}`;
    localStorage.setItem(key, JSON.stringify(items));
  }

  select(columns?: string, options?: { count?: string; head?: boolean }) {
    if (options?.head) {
      this.isHead = true;
    }
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push((item: any) => {
      if (value === null || value === undefined) {
        return item[column] === null || item[column] === undefined;
      }
      return String(item[column]) === String(value);
    });
    return this;
  }

  neq(column: string, value: any) {
    this.filters.push((item: any) => String(item[column]) !== String(value));
    return this;
  }

  not(column: string, operator: string, value: any) {
    if (operator === 'eq') {
      this.filters.push((item: any) => String(item[column]) !== String(value));
    }
    return this;
  }

  gte(column: string, value: any) {
    this.filters.push((item: any) => {
      const val = item[column];
      if (val === null || val === undefined) return false;
      return String(val) >= String(value);
    });
    return this;
  }

  lte(column: string, value: any) {
    this.filters.push((item: any) => {
      const val = item[column];
      if (val === null || val === undefined) return false;
      return String(val) <= String(value);
    });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderByField = column;
    this.orderAscending = options?.ascending !== false;
    return this;
  }

  limit(num: number) {
    this.limitNum = num;
    return this;
  }

  insert(rows: any | any[]) {
    this.pendingOp = () => {
      const items = this.getItems();
      const newRows = Array.isArray(rows) ? rows : [rows];
      const inserted: any[] = [];
      for (const row of newRows) {
        const newRow = {
          id: row.id || Math.random().toString(36).substring(2, 15),
          created_at: new Date().toISOString(),
          ...row
        };
        items.push(newRow);
        inserted.push(newRow);
      }
      this.saveItems(items);
      return { data: inserted, error: null };
    };
    return this;
  }

  update(payload: any) {
    this.pendingOp = () => {
      const items = this.getItems();
      let updatedCount = 0;
      const updatedItems: any[] = [];
      const modified = items.map((item: any) => {
        let match = true;
        for (const filter of this.filters) {
          if (!filter(item)) {
            match = false;
            break;
          }
        }
        if (match) {
          updatedCount++;
          const updated = { ...item, ...payload };
          updatedItems.push(updated);
          return updated;
        }
        return item;
      });
      this.saveItems(modified);
      return { data: updatedItems, error: null, count: updatedCount };
    };
    return this;
  }

  upsert(payload: any) {
    this.pendingOp = () => {
      const items = this.getItems();
      const payloads = Array.isArray(payload) ? payload : [payload];
      const upserted: any[] = [];
      for (const p of payloads) {
        const index = items.findIndex((item: any) => item.id === p.id);
        if (index !== -1) {
          items[index] = { ...items[index], ...p };
          upserted.push(items[index]);
        } else {
          const newRow = {
            id: p.id || Math.random().toString(36).substring(2, 15),
            created_at: new Date().toISOString(),
            ...p
          };
          items.push(newRow);
          upserted.push(newRow);
        }
      }
      this.saveItems(items);
      return { data: upserted, error: null };
    };
    return this;
  }

  delete() {
    this.pendingOp = () => {
      const items = this.getItems();
      const remaining = items.filter((item: any) => {
        let match = true;
        for (const filter of this.filters) {
          if (!filter(item)) {
            match = false;
            break;
          }
        }
        return !match;
      });
      this.saveItems(remaining);
      return { data: null, error: null };
    };
    return this;
  }

  execute() {
    if (this.pendingOp) {
      const res = this.pendingOp();
      this.pendingOp = null;
      return res;
    }

    let items = this.getItems();
    for (const filter of this.filters) {
      items = items.filter(filter);
    }
    if (this.orderByField) {
      const col = this.orderByField;
      const asc = this.orderAscending;
      items.sort((a: any, b: any) => {
        const valA = a[col];
        const valB = b[col];
        if (valA === valB) return 0;
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;
        if (typeof valA === 'number' && typeof valB === 'number') {
          return asc ? valA - valB : valB - valA;
        }
        return asc 
          ? String(valA).localeCompare(String(valB)) 
          : String(valB).localeCompare(String(valA));
      });
    }
    const count = items.length;
    if (this.isHead) {
      items = [];
    } else if (this.limitNum !== null) {
      items = items.slice(0, this.limitNum);
    }
    return { data: items, error: null, count };
  }

  async then(resolve: any, reject?: any) {
    try {
      const result = await this.execute();
      return resolve(result);
    } catch (err) {
      if (reject) return reject(err);
      throw err;
    }
  }

  async maybeSingle() {
    const { data } = await this.execute();
    const arr = Array.isArray(data) ? data : (data ? [data] : []);
    return { data: arr[0] || null, error: null };
  }

  async single() {
    const { data } = await this.execute();
    const arr = Array.isArray(data) ? data : (data ? [data] : []);
    if (arr.length === 0) {
      return { data: null, error: { message: 'Row not found', code: 'PGRST116' } };
    }
    return { data: arr[0], error: null };
  }
}

function seedLocalStorage() {
  if (!localStorage.getItem('local_db_users')) {
    localStorage.setItem('local_db_users', JSON.stringify([
      { id: 'local-user-1', email: 'offline@zenterprime.com', created_at: new Date().toISOString() }
    ]));
  }
  if (!localStorage.getItem('local_session_user')) {
    localStorage.setItem('local_session_user', JSON.stringify({
      id: 'local-user-1',
      email: 'offline@zenterprime.com',
      created_at: new Date().toISOString()
    }));
  }
  if (!localStorage.getItem('local_db_companies')) {
    localStorage.setItem('local_db_companies', JSON.stringify([
      {
        id: 'local-company-1',
        name: 'Local Demo Company',
        gstin: '22AAAAA0000A1Z1',
        address: '123 Main Street',
        is_deleted: false,
        created_at: new Date().toISOString(),
        created_by: 'local-user-1'
      }
    ]));
  }
  if (!localStorage.getItem('activeCompanyId')) {
    localStorage.setItem('activeCompanyId', 'local-company-1');
    localStorage.setItem('activeCompanyName', 'Local Demo Company');
  }
  if (!localStorage.getItem('local_db_profiles')) {
    localStorage.setItem('local_db_profiles', JSON.stringify([
      { id: 'local-user-1', active_company_id: 'local-company-1', full_name: 'Local User', created_at: new Date().toISOString() }
    ]));
  }
  if (!localStorage.getItem('local_db_sales_invoices')) {
    localStorage.setItem('local_db_sales_invoices', JSON.stringify([]));
  }
  if (!localStorage.getItem('local_db_purchase_bills')) {
    localStorage.setItem('local_db_purchase_bills', JSON.stringify([]));
  }
  if (!localStorage.getItem('local_db_customers')) {
    localStorage.setItem('local_db_customers', JSON.stringify([]));
  }
  if (!localStorage.getItem('local_db_vendors')) {
    localStorage.setItem('local_db_vendors', JSON.stringify([]));
  }
  if (!localStorage.getItem('local_db_stock_items')) {
    localStorage.setItem('local_db_stock_items', JSON.stringify([]));
  }
  if (!localStorage.getItem('local_db_cashbook')) {
    localStorage.setItem('local_db_cashbook', JSON.stringify([]));
  }
  if (!localStorage.getItem('local_db_duties_taxes')) {
    localStorage.setItem('local_db_duties_taxes', JSON.stringify([]));
  }
}

const mockAuth = {
  async getSession() {
    seedLocalStorage();
    const userJson = localStorage.getItem('local_session_user');
    if (!userJson) {
      return { data: { session: null }, error: null };
    }
    const user = JSON.parse(userJson);
    return {
      data: {
        session: {
          user,
          access_token: 'local-token',
          refresh_token: 'local-refresh-token'
        }
      },
      error: null
    };
  },
  async getUser() {
    seedLocalStorage();
    const userJson = localStorage.getItem('local_session_user');
    if (!userJson) {
      return { data: { user: null }, error: null };
    }
    return { data: { user: JSON.parse(userJson) }, error: null };
  },
  async signInWithPassword({ email }: any) {
    seedLocalStorage();
    const user = { id: 'local-user-1', email, created_at: new Date().toISOString() };
    localStorage.setItem('local_session_user', JSON.stringify(user));
    localStorage.setItem('activeCompanyId', 'local-company-1');
    localStorage.setItem('activeCompanyName', 'Local Demo Company');
    return { data: { user }, error: null };
  },
  async signUp({ email }: any) {
    seedLocalStorage();
    const user = { id: 'local-user-1', email, created_at: new Date().toISOString() };
    localStorage.setItem('local_session_user', JSON.stringify(user));
    localStorage.setItem('activeCompanyId', 'local-company-1');
    localStorage.setItem('activeCompanyName', 'Local Demo Company');
    return { data: { user }, error: null };
  },
  async signOut() {
    localStorage.removeItem('local_session_user');
    return { error: null };
  },
  onAuthStateChange(callback: any) {
    seedLocalStorage();
    const userJson = localStorage.getItem('local_session_user');
    const user = userJson ? JSON.parse(userJson) : null;
    const session = user ? { user, access_token: 'local-token' } : null;
    
    setTimeout(() => {
      callback(user ? 'SIGNED_IN' : 'SIGNED_OUT', session);
    }, 0);

    return {
      data: {
        subscription: {
          unsubscribe() {}
        }
      }
    };
  }
};

const mockSupabase = {
  auth: mockAuth,
  from(table: string) {
    return new MockBuilder(table);
  }
};

class ResilientQueryBuilder {
  realQb: any;
  mockQb: MockBuilder;
  table: string;

  constructor(table: string) {
    this.table = table;
    this.realQb = realSupabase.from(table);
    this.mockQb = new MockBuilder(table);
  }

  select(...args: any[]) {
    if (this.realQb?.select) this.realQb = this.realQb.select(...args);
    this.mockQb.select(...args);
    return this;
  }

  eq(...args: any[]) {
    if (this.realQb?.eq) this.realQb = this.realQb.eq(...args);
    this.mockQb.eq(...args);
    return this;
  }

  neq(...args: any[]) {
    if (this.realQb?.neq) this.realQb = this.realQb.neq(...args);
    this.mockQb.neq(...args);
    return this;
  }

  not(...args: any[]) {
    if (this.realQb?.not) this.realQb = this.realQb.not(...args);
    this.mockQb.not(...args);
    return this;
  }

  gte(...args: any[]) {
    if (this.realQb?.gte) this.realQb = this.realQb.gte(...args);
    this.mockQb.gte(...args);
    return this;
  }

  lte(...args: any[]) {
    if (this.realQb?.lte) this.realQb = this.realQb.lte(...args);
    this.mockQb.lte(...args);
    return this;
  }

  order(...args: any[]) {
    if (this.realQb?.order) this.realQb = this.realQb.order(...args);
    this.mockQb.order(...args);
    return this;
  }

  limit(...args: any[]) {
    if (this.realQb?.limit) this.realQb = this.realQb.limit(...args);
    this.mockQb.limit(...args);
    return this;
  }

  insert(...args: any[]) {
    if (this.realQb?.insert) this.realQb = this.realQb.insert(...args);
    this.mockQb.insert(...args);
    return this;
  }

  update(...args: any[]) {
    if (this.realQb?.update) this.realQb = this.realQb.update(...args);
    this.mockQb.update(...args);
    return this;
  }

  upsert(...args: any[]) {
    if (this.realQb?.upsert) this.realQb = this.realQb.upsert(...args);
    this.mockQb.upsert(...args);
    return this;
  }

  delete(...args: any[]) {
    if (this.realQb?.delete) this.realQb = this.realQb.delete(...args);
    this.mockQb.delete(...args);
    return this;
  }

  async execute() {
    if (typeof window !== 'undefined' && localStorage.getItem('use_offline_mode') === 'true') {
      return this.mockQb.execute();
    }
    try {
      const res = await this.realQb;
      if (res?.error && isNetworkError(res.error)) {
        console.warn(`[Supabase Network Warning] Query on '${this.table}' failed, using local offline storage.`, res.error);
        enableOfflineMode();
        return this.mockQb.execute();
      }
      return res;
    } catch (err: any) {
      if (isNetworkError(err)) {
        console.warn(`[Supabase Network Warning] Query on '${this.table}' threw network exception, using local offline storage.`, err.message || err);
        enableOfflineMode();
        return this.mockQb.execute();
      }
      throw err;
    }
  }

  async then(resolve: any, reject?: any) {
    try {
      const res = await this.execute();
      return resolve(res);
    } catch (err) {
      if (isNetworkError(err)) {
        enableOfflineMode();
        return resolve(this.mockQb.execute());
      }
      if (reject) return reject(err);
      throw err;
    }
  }

  async single() {
    if (typeof window !== 'undefined' && localStorage.getItem('use_offline_mode') === 'true') {
      return await this.mockQb.single();
    }
    try {
      const res = await (this.realQb?.single ? this.realQb.single() : this.realQb);
      if (res?.error && isNetworkError(res.error)) {
        enableOfflineMode();
        return await this.mockQb.single();
      }
      return res;
    } catch (err: any) {
      if (isNetworkError(err)) {
        enableOfflineMode();
        return await this.mockQb.single();
      }
      return { data: null, error: { message: err.message || 'Error', code: 'FETCH_ERROR' } };
    }
  }

  async maybeSingle() {
    if (typeof window !== 'undefined' && localStorage.getItem('use_offline_mode') === 'true') {
      return await this.mockQb.maybeSingle();
    }
    try {
      const res = await (this.realQb?.maybeSingle ? this.realQb.maybeSingle() : this.realQb);
      if (res?.error && isNetworkError(res.error)) {
        enableOfflineMode();
        return await this.mockQb.maybeSingle();
      }
      return res;
    } catch (err: any) {
      if (isNetworkError(err)) {
        enableOfflineMode();
        return await this.mockQb.maybeSingle();
      }
      return { data: null, error: null };
    }
  }
}

const resilientAuth = {
  async getSession() {
    if (typeof window !== 'undefined' && localStorage.getItem('use_offline_mode') === 'true') {
      return await mockAuth.getSession();
    }
    try {
      const res = await realSupabase.auth.getSession();
      if (res?.error && isNetworkError(res.error)) {
        enableOfflineMode();
        return await mockAuth.getSession();
      }
      return res;
    } catch (err: any) {
      if (isNetworkError(err)) {
        enableOfflineMode();
        return await mockAuth.getSession();
      }
      return { data: { session: null }, error: err };
    }
  },
  async getUser() {
    if (typeof window !== 'undefined' && localStorage.getItem('use_offline_mode') === 'true') {
      return await mockAuth.getUser();
    }
    try {
      const res = await realSupabase.auth.getUser();
      if (res?.error && isNetworkError(res.error)) {
        enableOfflineMode();
        return await mockAuth.getUser();
      }
      return res;
    } catch (err: any) {
      if (isNetworkError(err)) {
        enableOfflineMode();
        return await mockAuth.getUser();
      }
      return { data: { user: null }, error: err };
    }
  },
  async signInWithPassword(params: any) {
    if (typeof window !== 'undefined' && localStorage.getItem('use_offline_mode') === 'true') {
      return await mockAuth.signInWithPassword(params);
    }
    try {
      const res = await realSupabase.auth.signInWithPassword(params);
      if (res?.error && isNetworkError(res.error)) {
        enableOfflineMode();
        return await mockAuth.signInWithPassword(params);
      }
      return res;
    } catch (err: any) {
      if (isNetworkError(err)) {
        enableOfflineMode();
        return await mockAuth.signInWithPassword(params);
      }
      return { data: null, error: err };
    }
  },
  async signUp(params: any) {
    if (typeof window !== 'undefined' && localStorage.getItem('use_offline_mode') === 'true') {
      return await mockAuth.signUp(params);
    }
    try {
      const res = await realSupabase.auth.signUp(params);
      if (res?.error && isNetworkError(res.error)) {
        enableOfflineMode();
        return await mockAuth.signUp(params);
      }
      return res;
    } catch (err: any) {
      if (isNetworkError(err)) {
        enableOfflineMode();
        return await mockAuth.signUp(params);
      }
      return { data: null, error: err };
    }
  },
  async signOut(opts?: any) {
    try {
      await realSupabase.auth.signOut(opts);
    } catch {
      // ignore
    }
    return await mockAuth.signOut();
  },
  onAuthStateChange(callback: any) {
    try {
      const sub = realSupabase.auth.onAuthStateChange(callback);
      if (sub?.data?.subscription) return sub;
    } catch {
      // ignore
    }
    return mockAuth.onAuthStateChange(callback);
  }
};

export const supabase = {
  auth: resilientAuth,
  from(table: string) {
    return new ResilientQueryBuilder(table);
  }
} as any;

export async function getAuthUser() {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      if (error.message?.includes('Lock broken by another request')) {
        const { data: sessionData } = await supabase.auth.getSession();
        return sessionData?.session?.user || null;
      }
      return null;
    }
    return data?.user || null;
  } catch (err: any) {
    const errMsg = err?.message || (typeof err === 'string' ? err : '');
    if (errMsg.includes('Lock broken by another request') || errMsg.includes('steal')) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        return sessionData?.session?.user || null;
      } catch {
        return null;
      }
    }
    return null;
  }
}
