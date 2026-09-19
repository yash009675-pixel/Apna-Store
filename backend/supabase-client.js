/* Apna Store — Supabase browser client
   Fill these two values only after creating the Supabase project.
   Never put a service-role key or database password here.
*/
window.APNA_SUPABASE_CONFIG = {
  url: "",
  anonKey: ""
};

window.apnaSupabaseReady = function () {
  return Boolean(
    window.APNA_SUPABASE_CONFIG &&
    window.APNA_SUPABASE_CONFIG.url &&
    window.APNA_SUPABASE_CONFIG.anonKey
  );
};
