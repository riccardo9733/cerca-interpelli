import { createClient, SupabaseClient } from '@supabase/supabase-js';

if (typeof globalThis.WebSocket === 'undefined') {
  class DummyWebSocket {}
  (globalThis as any).WebSocket = DummyWebSocket;
}

const DEFAULT_SUPABASE_URL = 'https://oysatbtuiyfupeuezzai.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95c2F0YnR1aXlmdXBldWV6emFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNjE5MTAsImV4cCI6MjEwNDYzNzkxMH0.tt0CGIDxWXQwmdcEtEnTi3lZurmCgBB03QN-bXCr0Xs';

export function getValidUrl(): string {
  let envUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
  if (envUrl.startsWith('ttps://')) {
    envUrl = 'h' + envUrl;
  }
  if (envUrl.startsWith('http://') || envUrl.startsWith('https://')) {
    return envUrl.replace(/\/+$/, '');
  }
  return DEFAULT_SUPABASE_URL;
}

export function getValidAnonKey(): string {
  const envKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
  if (envKey.length > 20) {
    return envKey;
  }
  return DEFAULT_SUPABASE_ANON_KEY;
}

export function getValidServiceKey(): string {
  const envKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
  if (envKey.length > 20) {
    return envKey;
  }
  return DEFAULT_SUPABASE_ANON_KEY;
}

export function getSupabaseClient(): SupabaseClient {
  return createClient(getValidUrl(), getValidAnonKey(), { auth: { persistSession: false } });
}

export function getAdminSupabase(): SupabaseClient {
  return createClient(getValidUrl(), getValidServiceKey(), { auth: { persistSession: false } });
}

// Client Proxy valutato pigramente (lazy) solo a runtime per evitare errori durante il build di Vercel
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseClient();
    const val = (client as any)[prop];
    if (typeof val === 'function') {
      return val.bind(client);
    }
    return val;
  }
});
