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

/*
 * Keep one stable browser auth session across every ApnaStore page.
 * These options are explicit so future client/config changes cannot
 * accidentally fall back to non-persistent auth behaviour.
 *
 * We intentionally do NOT change storageKey: this preserves the existing
 * Supabase session already stored in users' browsers.
 */
const apnaAuthStorage =
  typeof window !== "undefined" && window.localStorage
    ? window.localStorage
    : undefined;

window.apnaSupabase = window.supabase.createClient(
  window.APNA_SUPABASE_CONFIG.url,
  window.APNA_SUPABASE_CONFIG.anonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: apnaAuthStorage,
    },
  }
);

/*
 * iOS Safari/PWA can suspend background timers. When the page becomes
 * visible again, explicitly resume Supabase's refresh loop and refresh
 * the current session if one exists. A refresh failure is logged only;
 * we never turn a transient refresh error into an application logout.
 */
if (window.apnaSupabase?.auth) {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    window.apnaSupabase.auth.startAutoRefresh?.();
    window.apnaSupabase.auth.refreshSession?.().catch((error) => {
      console.warn("Apna Store session refresh deferred:", error?.message || error);
    });
  });
}
