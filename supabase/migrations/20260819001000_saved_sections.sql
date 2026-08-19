begin;

-- Site-owned "My Saved" library.
--
-- This is deliberately not the `sections` table. `sections` is the central
-- NCloud template library shared by every site; `saved_sections` belongs to
-- exactly one site and is never visible to another. Keeping them apart means a
-- tenant row can never be reached by a query written against the global
-- library, and the two can evolve independently.
--
-- Additive only. No existing table, column, constraint, function, trigger, or
-- row is altered.

-- Keep the change bounded. If another session holds a conflicting lock, fail
-- and roll back rather than waiting indefinitely.
set local lock_timeout = '5s';

create table if not exists public.saved_sections (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null,
  name text not null,
  shortcode text not null,
  css_code text,
  -- Object path inside the `section-previews` Storage bucket. The image itself
  -- never lives in Postgres, only the path to it.
  preview_storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A saved section cannot outlive the site that owns it.
  constraint saved_sections_site_fk
    foreign key (site_id) references public.sites (id) on delete cascade,
  constraint saved_sections_name_not_blank
    check (char_length(btrim(name)) between 1 and 200),
  constraint saved_sections_shortcode_not_blank
    check (char_length(btrim(shortcode)) between 1 and 200000),
  -- Absence is null and never a blank string, so `is null` is the only test a
  -- caller needs.
  constraint saved_sections_css_code_present
    check (
      css_code is null
      or char_length(btrim(css_code)) between 1 and 100000
    ),
  -- A stored path must be a plain relative object key: no surrounding
  -- whitespace, no leading slash, and no parent-directory traversal.
  constraint saved_sections_preview_path_shape
    check (
      preview_storage_path is null
      or (
        preview_storage_path = btrim(preview_storage_path)
        and char_length(preview_storage_path) between 1 and 1000
        and preview_storage_path !~ '^/'
        and preview_storage_path !~ '\.\.'
      )
    )
);

-- Matches the only listing query: one site's rows, newest first.
create index if not exists saved_sections_site_created_idx
  on public.saved_sections (site_id, created_at desc);

-- Reuse the existing helper rather than adding a second one.
do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_trigger
    where tgrelid = 'public.saved_sections'::regclass
      and tgname = 'saved_sections_set_updated_at'
  ) then
    create trigger saved_sections_set_updated_at
    before update on public.saved_sections
    for each row execute function public.set_updated_at();
  end if;
end
$$;

-- Same posture as sites, runners, and jobs: row level security on with no
-- policy, every privilege revoked from anon and authenticated, and access
-- granted only to service_role, which the Control API uses server-side. A
-- public Storage bucket makes preview images fetchable by URL; it does not
-- make these rows readable.
alter table public.saved_sections enable row level security;

revoke all privileges on table public.saved_sections from public, anon, authenticated;

grant select, insert, update, delete on table public.saved_sections to service_role;

comment on table public.saved_sections is
  'Per-site My Saved library. Scoped to one site, separate from the shared public.sections template library.';
comment on column public.saved_sections.preview_storage_path is
  'Object path inside the section-previews Storage bucket. Null when no preview has been uploaded.';

commit;
