#!/bin/sh
#  يشغّل supabase/rls-test.sql على قاعدةٍ محليّة نظيفة.
#
#  القاعدةُ المحليّة ليست Supabase: ينقصها مخطّطُ auth وجداوله،
#  ودالّةُ auth.uid()، وتوابعُ storage. فتُهيّأ هنا كما تبنيها
#  Supabase — وبلا ذلك تفشل خمس عشرة خطوةً لنقصٍ في البيئة لا
#  لثغرةٍ في السياسات، وهو أسوأ من الفشل: يُقرأ خطأً.
#
#      sh tools/fahs-rls.sh
#
#  المتوقّع: «فشل = 0». وأيُّ «✗» ثغرةٌ تُراجَع قبل الدفع.
set -e
PORT=${PGPORT:-54329}
DIR=${PGDIR:-/var/lib/postgresql/tp-rls}
export PATH=/usr/lib/postgresql/16/bin:$PATH

if ! psql -h /tmp -p "$PORT" -U postgres -c 'select 1' >/dev/null 2>&1; then
  rm -rf "$DIR"; mkdir -p "$DIR"; chown postgres:postgres "$DIR"
  su postgres -s /bin/sh -c "PATH=$PATH initdb -D $DIR -A trust -U postgres" >/dev/null
  su postgres -s /bin/sh -c "PATH=$PATH pg_ctl -D $DIR -o '-p $PORT -k /tmp' -l $DIR/log start" >/dev/null
  sleep 3
fi

psql -h /tmp -p "$PORT" -U postgres -q <<'SQL'
drop schema if exists public cascade;   create schema public;
grant all on schema public to public;
create schema if not exists auth;
create schema if not exists extensions;
create schema if not exists storage;
create extension if not exists pgcrypto with schema extensions;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(), email text unique,
  encrypted_password text, email_confirmed_at timestamptz,
  raw_app_meta_data jsonb default '{}',
  updated_at timestamptz default now(), created_at timestamptz default now());
create table if not exists auth.refresh_tokens (
  id bigserial primary key, user_id text, token text, revoked boolean default false);
truncate auth.users cascade; truncate auth.refresh_tokens;

--  هويّةُ صاحب الطلب: PostgREST يضعها في request.jwt.claim.sub،
--  وعليها تقوم سياساتُ RLS كلُّها.
create or replace function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create or replace function storage.foldername(name text) returns text[]
  language sql immutable as $$ select string_to_array(name, '/') $$;
create table if not exists storage.objects (id uuid primary key default gen_random_uuid(),
  bucket_id text, name text, owner uuid);
create table if not exists storage.buckets (id text primary key, name text,
  public boolean default false);

do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role anon nologin;          exception when duplicate_object then null; end $$;
grant usage on schema public, auth, extensions, storage to authenticated, anon;
SQL

psql -h /tmp -p "$PORT" -U postgres -q -f supabase/schema.sql
psql -h /tmp -p "$PORT" -U postgres -f supabase/rls-test.sql 2>&1 | tail -40
