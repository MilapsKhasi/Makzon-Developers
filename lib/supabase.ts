import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL || 'https://blbaolnlzohguwqiyflg.supabase.co';
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsYmFvbG5sem9oZ3V3cWl5ZmxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxMjY2ODgsImV4cCI6MjA4MzcwMjY4OH0.nGCG_M3-m2hNnP8Nu0aftZ1Ug0OheU5GmbGNr-Iwxxg';

const supabaseUrl = rawUrl.trim().replace(/['"]/g, '');
const supabaseAnonKey = rawKey.trim().replace(/['"]/g, '');

// Ensure URL has protocol
const finalUrl = supabaseUrl.startsWith('http') ? supabaseUrl : `https://${supabaseUrl}`;

const realSupabase = createClient(finalUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  global: {
    fetch: (...args) => fetch(...args)
  }
});

// --- Mock Offline Supabase Client ---
class MockBuilder {
  table: string;
  filters: Array<(item: any) => boolean> = [];
  orderByField: string | null = null;
  orderAscending: boolean = true;
  limitNum: number | null = null;
  isHead: boolean = false;

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

  async execute() {
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
    return { data: data[0] || null, error: null };
  }

  async single() {
    const { data } = await this.execute();
    if (data.length === 0) {
      return { data: null, error: { message: 'Row not found', code: 'PGRST116' } };
    }
    return { data: data[0], error: null };
  }

  async insert(rows: any | any[]) {
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
  }

  async update(payload: any) {
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
  }

  async upsert(payload: any) {
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
  }

  async delete() {
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
  }
}

function seedLocalStorage() {
  if (!localStorage.getItem('local_db_users')) {
    localStorage.setItem('local_db_users', JSON.stringify([
      { id: 'local-user-1', email: 'offline@zenterprime.com', created_at: new Date().toISOString() }
    ]));
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
  if (!localStorage.getItem('local_db_profiles')) {
    localStorage.setItem('local_db_profiles', JSON.stringify([
      { id: 'local-user-1', active_company_id: 'local-company-1', full_name: 'Local User', created_at: new Date().toISOString() }
    ]));
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
  async signInWithPassword({ email, password }: any) {
    seedLocalStorage();
    const user = { id: 'local-user-1', email, created_at: new Date().toISOString() };
    localStorage.setItem('local_session_user', JSON.stringify(user));
    localStorage.setItem('activeCompanyId', 'local-company-1');
    localStorage.setItem('activeCompanyName', 'Local Demo Company');
    return { data: { user }, error: null };
  },
  async signUp({ email, password }: any) {
    seedLocalStorage();
    const user = { id: 'local-user-1', email, created_at: new Date().toISOString() };
    localStorage.setItem('local_session_user', JSON.stringify(user));
    localStorage.setItem('activeCompanyId', 'local-company-1');
    localStorage.setItem('activeCompanyName', 'Local Demo Company');
    return { data: { user }, error: null };
  },
  async signOut() {
    localStorage.removeItem('local_session_user');
    localStorage.removeItem('activeCompanyId');
    localStorage.removeItem('activeCompanyName');
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

const isOffline = typeof window !== 'undefined' && window.localStorage?.getItem('use_offline_mode') === 'true';

export const supabase = isOffline ? (mockSupabase as any) : realSupabase;

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
