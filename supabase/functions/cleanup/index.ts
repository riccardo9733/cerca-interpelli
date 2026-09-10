// Supabase Edge Function: Cleanup Interpelli Scaduti (>48h)
// Deployed to https://<project-ref>.supabase.co/functions/v1/cleanup

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    const FORTY_EIGHT_HOURS_MS = 48 * 3600 * 1000;

    const { data: rows, error } = await supabase.from('interpelli').select('id, wp_date, scadenza');
    if (error) throw error;

    const idsToDelete: number[] = [];

    (rows || []).forEach(row => {
      let isExpired = false;
      let expiredForMs = 0;

      if (row.scadenza) {
        const expDt = new Date(row.scadenza);
        if (!isNaN(expDt.getTime())) {
          expiredForMs = now.getTime() - expDt.getTime();
          isExpired = expiredForMs > 0;
        }
      } else if (row.wp_date) {
        const wpDt = new Date(row.wp_date);
        if (!isNaN(wpDt.getTime())) {
          expiredForMs = now.getTime() - (wpDt.getTime() + 7 * 86400 * 1000);
          isExpired = expiredForMs > 0;
        }
      }

      if (isExpired && expiredForMs >= FORTY_EIGHT_HOURS_MS) {
        idsToDelete.push(row.id);
      }
    });

    let deletedCount = 0;
    if (idsToDelete.length > 0) {
      const { error: delErr } = await supabase
        .from('interpelli')
        .delete()
        .in('id', idsToDelete);

      if (delErr) throw delErr;
      deletedCount = idsToDelete.length;
    }

    return new Response(
      JSON.stringify({
        success: true,
        deleted_count: deletedCount,
        deleted_ids: idsToDelete,
        message: `Pulizia completata da Supabase Edge Function: eliminati ${deletedCount} record.`
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
