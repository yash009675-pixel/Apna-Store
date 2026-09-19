/* Apna Store — Supabase browser client */
window.APNA_SUPABASE_CONFIG = {
  url: "https://xxedwtmdylfufrfzyrdb.supabase.co",
  anonKey: "sb_publishable_hYQybdzwpuTiT1CA7ZE0EA_SRHPyCOS"
};

window.apnaSupabaseReady = function () {
  return Boolean(
    window.APNA_SUPABASE_CONFIG.url &&
    window.APNA_SUPABASE_CONFIG.anonKey
  );
};

window.apnaSupabase = window.supabase.createClient(
  window.APNA_SUPABASE_CONFIG.url,
  window.APNA_SUPABASE_CONFIG.anonKey
);