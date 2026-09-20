-- Harden Phase 12 trigger helper: it is invoked by the database trigger, not the API.
revoke execute on function public.reviews_protect_immutable_fields() from public, anon, authenticated;
