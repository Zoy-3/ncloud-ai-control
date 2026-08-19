begin;

-- Storage-backed preview images for central templates.
--
-- public.sections already carries preview_screenshot_url, which older records
-- populate with a full URL. This adds the Storage object path alongside it so
-- previews uploaded through the admin manager live in the section-previews
-- bucket like saved-section previews do.
--
-- The existing URL column is deliberately left in place and untouched: readers
-- prefer preview_storage_path when it is set and fall back to
-- preview_screenshot_url, so existing records keep working unchanged.
--
-- Additive only. Nothing is dropped, renamed, or rewritten, and no row is
-- modified.

set local lock_timeout = '5s';

alter table public.sections
  add column if not exists preview_storage_path text;

-- Absence is null and never a blank string, and a stored path must be a plain
-- relative object key: no surrounding whitespace, no leading slash, and no
-- parent-directory traversal. This matches saved_sections.
do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.sections'::regclass
      and conname = 'sections_preview_path_shape'
  ) then
    alter table public.sections
      add constraint sections_preview_path_shape
        check (
          preview_storage_path is null
          or (
            preview_storage_path = btrim(preview_storage_path)
            and char_length(preview_storage_path) between 1 and 1000
            and preview_storage_path !~ '^/'
            and preview_storage_path !~ '\.\.'
          )
        );
  end if;
end
$$;

comment on column public.sections.preview_storage_path is
  'Object path inside the section-previews Storage bucket. Preferred over preview_screenshot_url when set; null when no preview has been uploaded.';

commit;
