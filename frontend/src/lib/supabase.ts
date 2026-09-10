import { createClient, SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://oysatbtuiyfupeuezzai.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95c2F0YnR1aXlmdXBldWV6emFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNjE5MTAsImV4cCI6MjEwNDYzNzkxMH0.tt0CGIDxWXQwmdcEtEnTi3lZurmCgBB03QN-bXCr0Xs';

function getValidUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (envUrl && envUrl.startsWith('http')) {
    return envUrl;
  }
  return DEFAULT_SUPABASE_URL;
}

function getValidAnonKey(): string {
  const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (envKey && envKey.trim().length > 10) {
    return envKey;
  }
  return DEFAULT_SUPABASE_ANON_KEY;
}

function getValidServiceKey(): string {
  const envKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (envKey && envKey.trim().length > 10) {
    return envKey;
  }
  return DEFAULT_SUPABASE_ANON_KEY;
}

export function getSupabaseClient(): SupabaseClient {
  return createClient(getValidUrl(), getValidAnonKey());
}

export function getAdminSupabase(): SupabaseClient {
  return createClient(getValidUrl(), getValidServiceKey());
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
