import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL || 'https://blbaolnlzohguwqiyflg.supabase.co';
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsYmFvbG5sem9oZ3V3cWl5ZmxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxMjY2ODgsImV4cCI6MjA4MzcwMjY4OH0.nGCG_M3-m2hNnP8Nu0aftZ1Ug0OheU5GmbGNr-Iwxxg';

const supabaseUrl = rawUrl.trim().replace(/['"]/g, '');
const supabaseAnonKey = rawKey.trim().replace(/['"]/g, '');

// Ensure URL has protocol
const finalUrl = supabaseUrl.startsWith('http') ? supabaseUrl : `https://${supabaseUrl}`;

export const supabase = createClient(finalUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  global: {
    fetch: (...args) => fetch(...args)
  }
});

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