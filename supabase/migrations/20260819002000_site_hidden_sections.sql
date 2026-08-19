begin;

-- Per-site visibility preference for central templates.
--
-- A WordPress site may hide a template from its own library. That is a
-- preference, not a deletion: the row in public.sections is untouched and every
-- other site still sees the template. Sites can never delete central templates,
-- so this table is the only mechanism they have for removing one from view.
--
-- Additive only. No existing table, column, constraint, function, trigger, or
-- row is altered.

set local lock_timeout = '5s';

create table if not exists public.site_hidden_sections (
  site_id uuid not null,
  section_id uuid not null,
  created_at timestamptz not null default now(),
  -- One preference per site and template. The composite key is the primary
  -- key, so hiding twice is impossible rather than merely discouraged.
  constraint site_hidden_sections_pkey primary key (site_id, section_id),
  -- A preference cannot outlive either side of the pair it refers to.
  constraint site_hidden_sections_site_fk
    foreign key (site_id) references public.sites (id) on delete cascade,
  constraint site_hidden_sections_section_fk
    foreign key (section_id) references public.sections (id) on delete cascade
);

-- The listing asks "which templates has this site hidden", which the primary
-- key already serves. This index serves the reverse question, used when a
-- template is archived or removed centrally.
create index if not exists site_hidden_sections_section_idx
  on public.site_hidden_sections (section_id);

-- Same posture as sites, runners, jobs, and saved_sections: row level security
-- on with no policy, every privilege revoked from anon and authenticated, and
-- access granted only to service_role, which the Control API uses server-side.
alter table public.site_hidden_sections enable row level security;

revoke all privileges on table public.site_hidden_sections from public, anon, authenticated;

grant select, insert, update, delete on table public.site_hidden_sections to service_role;

comment on table public.site_hidden_sections is
  'Per-site visibility preference for central public.sections templates. Hiding is site-local and never deletes the template.';

commit;
