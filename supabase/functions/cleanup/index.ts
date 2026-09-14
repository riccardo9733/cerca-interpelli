// Supabase Edge Function: Cleanup Interpelli Scaduti (>48h)
// Deployed to https://<project-ref>.supabase.co/functions/v1/cleanup

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    const FORTY_EIGHT_HOURS_MS = 48 * 3600 * 1000;
    const NINE_DAYS_MS = 9 * 86400 * 1000; // 7 giorni validità di default + 48h

    const cutoffScadenza = new Date(now.getTime() - FORTY_EIGHT_HOURS_MS).toISOString();
    const cutoffWpDate = new Date(now.getTime() - NINE_DAYS_MS).toISOString();

    // 1. Elimina interpelli con data di scadenza esplicita scaduta da oltre 48 ore
    const { data: del1, error: err1 } = await supabase
      .from('interpelli')
      .delete()
      .not('scadenza', 'is', null)
      .lt('scadenza', cutoffScadenza)
      .select('id');

    if (err1) {
      console.error("Errore eliminazione scadenza esplicita:", err1);
      throw err1;
    }

    // 2. Elimina interpelli senza scadenza esplicita pubblicati da oltre 9 giorni (>7gg + 48h)
    const { data: del2, error: err2 } = await supabase
      .from('interpelli')
      .delete()
      .is('scadenza', null)
      .lt('wp_date', cutoffWpDate)
      .select('id');

    if (err2) {
      console.error("Errore eliminazione fallback wp_date:", err2);
      throw err2;
    }

    const deletedIds = [
      ...(del1 || []).map((r: { id: number }) => r.id),
      ...(del2 || []).map((r: { id: number }) => r.id),
    ];
    const deletedCount = deletedIds.length;

    return new Response(
      JSON.stringify({
        success: true,
        deleted_count: deletedCount,
        deleted_ids: deletedIds,
        message: `Pulizia completata da Supabase Edge Function: eliminati ${deletedCount} record.`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Errore Edge Function cleanup:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
