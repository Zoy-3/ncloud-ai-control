begin;

-- A reusable section is three separate things: a preview image, the Flatsome
-- shortcode, and the CSS that styles it. The CSS is stored in its own column so
-- it is never concatenated into the shortcode. The plugin inserts the shortcode
-- into the UX Block Code editor and offers the CSS as a separate copy action;
-- nothing injects CSS into WordPress automatically.
--
-- Additive only. No existing column, constraint, index, function, or row is
-- altered. Existing sections keep css_code = null.

-- Keep the change bounded. If another session holds a lock on the table, fail
-- and roll back rather than waiting indefinitely.
set local lock_timeout = '5s';

alter table public.sections
  add column if not exists css_code text;

-- Absence is represented by null and never by a blank string, so a caller can
-- rely on `css_code is null` meaning "this section has no CSS".
do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.sections'::regclass
      and conname = 'sections_css_code_present'
  ) then
    alter table public.sections
      add constraint sections_css_code_present
        check (
          css_code is null
          or char_length(btrim(css_code)) between 1 and 100000
        );
  end if;
end
$$;

comment on column public.sections.css_code is
  'Optional CSS for the section, stored separately from the Flatsome shortcode. Null when the section needs no CSS.';

commit;
