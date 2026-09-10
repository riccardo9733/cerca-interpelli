import { createClient, SupabaseClient } from '@supabase/supabase-js';

function getValidUrl(urlStr?: string): string {
  if (urlStr && (urlStr.startsWith('http://') || urlStr.startsWith('https://'))) {
    return urlStr;
  }
  return 'https://placeholder.supabase.co';
}

function getValidKey(keyStr?: string): string {
  return keyStr && keyStr.trim().length > 0 ? keyStr : 'placeholder-key';
}

export function getSupabaseClient(): SupabaseClient {
  const url = getValidUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = getValidKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  return createClient(url, key);
}

export function getAdminSupabase(): SupabaseClient {
  const url = getValidUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = getValidKey(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  return createClient(url, key);
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
