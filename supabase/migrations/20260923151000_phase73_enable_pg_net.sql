-- Phase 73: enable pg_net for asynchronous webhook delivery
create schema if not exists extensions;
create extension if not exists pg_net with schema extensions;
