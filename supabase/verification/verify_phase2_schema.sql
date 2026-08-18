-- Read-only verification for the already-applied Phase 2 schema.
-- This file does not create, alter, update, or delete anything.
-- Run it once in the Supabase SQL Editor. A passing schema returns only the
-- final summary row with pass=true and actual ending in "0 failures".
-- Definition checks compare the migration's semantic invariants against
-- PostgreSQL-normalized catalog output.

with
expected_tables(table_name) as (
  values ('sites'), ('runners'), ('jobs')
),
table_catalog as (
  select
    expected.table_name,
    relation.oid,
    relation.relowner,
    relation.relacl,
    relation.relkind,
    relation.relrowsecurity,
    relation.relforcerowsecurity
  from expected_tables as expected
  left join pg_catalog.pg_namespace as namespace
    on namespace.nspname = 'public'
  left join pg_catalog.pg_class as relation
    on relation.relnamespace = namespace.oid
   and relation.relname = expected.table_name
),
table_checks as (
  select
    'tables / rls'::text as category,
    format('public.%I', table_name) as object_name,
    'exists_and_rls_enabled'::text as check_name,
    oid is not null
      and relkind = 'r'
      and relrowsecurity
      and not relforcerowsecurity as pass,
    'ordinary table; RLS enabled; forced RLS disabled'::text as expected,
    case
      when oid is null then 'missing'
      else format(
        'relkind=%s; relrowsecurity=%s; relforcerowsecurity=%s',
        relkind,
        relrowsecurity,
        relforcerowsecurity
      )
    end as actual
  from table_catalog
),
expected_constraints(
  table_name,
  constraint_name,
  constraint_type,
  target_table,
  delete_action,
  definition_pattern,
  expected_definition
) as (
  values
    ('sites', 'sites_pkey', 'p', null, null,
      $$primary key \(id\)$$,
      'PRIMARY KEY (id)'),
    ('sites', 'sites_name_not_blank', 'c', null, null,
      $$char_length\(btrim\(name\)\).*>= 1.*<= 200$$,
      'name length is 1..200 after trimming'),
    ('sites', 'sites_domain_normalized', 'c', null, null,
      $$char_length\(domain\).*>= 1.*<= 253.*domain = lower\(btrim\(domain\)\)$$,
      'domain length is 1..253 and normalized lowercase'),
    ('sites', 'sites_domain_unique', 'u', null, null,
      $$unique \(domain\)$$,
      'UNIQUE (domain)'),
    ('sites', 'sites_token_hash_format', 'c', null, null,
      $$site_token_hash.*0-9a-f.*64$$,
      'site token hash is 64 lowercase hexadecimal characters'),
    ('sites', 'sites_token_hash_unique', 'u', null, null,
      $$unique \(site_token_hash\)$$,
      'UNIQUE (site_token_hash)'),
    ('sites', 'sites_status_allowed', 'c', null, null,
      $$status.*active.*disabled$$,
      'status is active or disabled'),

    ('runners', 'runners_pkey', 'p', null, null,
      $$primary key \(id\)$$,
      'PRIMARY KEY (id)'),
    ('runners', 'runners_name_not_blank', 'c', null, null,
      $$char_length\(btrim\(name\)\).*>= 1.*<= 200$$,
      'name length is 1..200 after trimming'),
    ('runners', 'runners_name_unique', 'u', null, null,
      $$unique \(name\)$$,
      'UNIQUE (name)'),
    ('runners', 'runners_token_hash_format', 'c', null, null,
      $$token_hash.*0-9a-f.*64$$,
      'runner token hash is 64 lowercase hexadecimal characters'),
    ('runners', 'runners_token_hash_unique', 'u', null, null,
      $$unique \(token_hash\)$$,
      'UNIQUE (token_hash)'),
    ('runners', 'runners_status_allowed', 'c', null, null,
      $$status.*online.*offline.*disabled$$,
      'status is online, offline, or disabled'),
    ('runners', 'runners_current_job_fk', 'f', 'jobs', 'n',
      $$foreign key \(current_job_id\).*references (public\.)?jobs\(id\).*set null$$,
      'current_job_id references jobs(id) ON DELETE SET NULL'),

    ('jobs', 'jobs_pkey', 'p', null, null,
      $$primary key \(id\)$$,
      'PRIMARY KEY (id)'),
    ('jobs', 'jobs_site_fk', 'f', 'sites', 'r',
      $$foreign key \(site_id\).*references (public\.)?sites\(id\).*restrict$$,
      'site_id references sites(id) ON DELETE RESTRICT'),
    ('jobs', 'jobs_claimed_runner_fk', 'f', 'runners', 'r',
      $$foreign key \(claimed_by_runner_id\).*references (public\.)?runners\(id\).*restrict$$,
      'claimed_by_runner_id references runners(id) ON DELETE RESTRICT'),
    ('jobs', 'jobs_type_allowed', 'c', null, null,
      $$type.*generate_section$$,
      'type is generate_section'),
    ('jobs', 'jobs_prompt_not_blank', 'c', null, null,
      $$char_length\(btrim\(prompt\)\).*>= 1.*<= 10000$$,
      'prompt length is 1..10000 after trimming'),
    ('jobs', 'jobs_context_is_object', 'c', null, null,
      $$jsonb_typeof\(context_json\).*object$$,
      'context_json is a JSON object'),
    ('jobs', 'jobs_status_allowed', 'c', null, null,
      $$status.*pending.*processing.*completed.*failed$$,
      'status is pending, processing, completed, or failed'),
    ('jobs', 'jobs_started_after_created', 'c', null, null,
      $$started_at.*created_at$$,
      'started_at is null or not before created_at'),
    ('jobs', 'jobs_completed_after_started', 'c', null, null,
      $$completed_at.*started_at$$,
      'completed_at is null or not before started_at'),
    ('jobs', 'jobs_state_shape', 'c', null, null,
      $$status.*pending.*status.*processing.*status.*completed.*status.*failed.*result_shortcode.*error_message$$,
      'state-specific ownership, timestamp, result, and error shape')
),
constraint_catalog as (
  select
    expected.*,
    constraint_row.oid,
    constraint_row.contype,
    constraint_row.convalidated,
    constraint_row.confrelid,
    constraint_row.confdeltype,
    pg_catalog.pg_get_constraintdef(constraint_row.oid, true) as definition
  from expected_constraints as expected
  left join pg_catalog.pg_namespace as namespace
    on namespace.nspname = 'public'
  left join pg_catalog.pg_class as relation
    on relation.relnamespace = namespace.oid
   and relation.relname = expected.table_name
  left join pg_catalog.pg_constraint as constraint_row
    on constraint_row.conrelid = relation.oid
   and constraint_row.conname = expected.constraint_name
),
constraint_checks as (
  select
    'constraints / foreign keys'::text as category,
    format('public.%I', table_name) as object_name,
    constraint_name::text as check_name,
    oid is not null
      and contype = constraint_type::"char"
      and convalidated
      and lower(definition) ~ definition_pattern
      and (
        target_table is null
        or (
          confrelid = format('public.%I', target_table)::regclass
          and confdeltype = delete_action::"char"
        )
      ) as pass,
    expected_definition as expected,
    case
      when oid is null then 'missing'
      else format(
        'type=%s; validated=%s; definition=%s',
        contype,
        convalidated,
        definition
      )
    end as actual
  from constraint_catalog
),
expected_indexes(
  table_name,
  index_name,
  is_unique,
  definition_pattern,
  predicate_pattern,
  expected_definition
) as (
  values
    ('runners', 'runners_current_job_unique_idx', true,
      $$\(current_job_id\)$$,
      $$current_job_id.*is not null$$,
      'UNIQUE (current_job_id) WHERE current_job_id IS NOT NULL'),
    ('jobs', 'jobs_one_processing_per_runner_idx', true,
      $$\(claimed_by_runner_id\)$$,
      $$status.*processing$$,
      'UNIQUE (claimed_by_runner_id) WHERE status = processing'),
    ('jobs', 'jobs_pending_queue_idx', false,
      $$\(created_at, id\)$$,
      $$status.*pending$$,
      '(created_at, id) WHERE status = pending'),
    ('jobs', 'jobs_status_created_idx', false,
      $$\(status, created_at desc\)$$,
      null,
      '(status, created_at DESC)'),
    ('jobs', 'jobs_site_created_idx', false,
      $$\(site_id, created_at desc\)$$,
      null,
      '(site_id, created_at DESC)'),
    ('jobs', 'jobs_runner_created_idx', false,
      $$\(claimed_by_runner_id, created_at desc\)$$,
      $$claimed_by_runner_id.*is not null$$,
      '(claimed_by_runner_id, created_at DESC) WHERE claimed_by_runner_id IS NOT NULL'),
    ('runners', 'runners_last_seen_idx', false,
      $$\(last_seen_at desc\)$$,
      null,
      '(last_seen_at DESC)')
),
index_catalog as (
  select
    expected.*,
    index_relation.oid,
    index_row.indisunique,
    index_row.indisvalid,
    index_row.indisready,
    pg_catalog.pg_get_indexdef(index_relation.oid) as definition,
    pg_catalog.pg_get_expr(index_row.indpred, index_row.indrelid) as predicate
  from expected_indexes as expected
  left join pg_catalog.pg_namespace as namespace
    on namespace.nspname = 'public'
  left join pg_catalog.pg_class as index_relation
    on index_relation.relnamespace = namespace.oid
   and index_relation.relname = expected.index_name
   and index_relation.relkind = 'i'
  left join pg_catalog.pg_index as index_row
    on index_row.indexrelid = index_relation.oid
),
index_checks as (
  select
    'indexes'::text as category,
    format('public.%I', table_name) as object_name,
    index_name::text as check_name,
    oid is not null
      and indisunique = is_unique
      and indisvalid
      and indisready
      and lower(definition) ~ definition_pattern
      and (
        (predicate_pattern is null and predicate is null)
        or (predicate_pattern is not null and lower(predicate) ~ predicate_pattern)
      ) as pass,
    expected_definition as expected,
    case
      when oid is null then 'missing'
      else format(
        'unique=%s; valid=%s; ready=%s; definition=%s; predicate=%s',
        indisunique,
        indisvalid,
        indisready,
        definition,
        coalesce(predicate, '<none>')
      )
    end as actual
  from index_catalog
),
expected_triggers(table_name, trigger_name, definition_pattern) as (
  values
    ('sites', 'sites_set_updated_at', $$before update on (public\.)?sites.*set_updated_at$$),
    ('runners', 'runners_set_updated_at', $$before update on (public\.)?runners.*set_updated_at$$),
    ('jobs', 'jobs_enforce_status_transition', $$before update of status on (public\.)?jobs.*enforce_job_status_transition$$)
),
trigger_checks as (
  select
    'triggers'::text as category,
    format('public.%I', expected.table_name) as object_name,
    expected.trigger_name::text as check_name,
    trigger_row.oid is not null
      and trigger_row.tgenabled = 'O'
      and lower(pg_catalog.pg_get_triggerdef(trigger_row.oid, true)) ~ expected.definition_pattern as pass,
    'enabled trigger matching the migration'::text as expected,
    case
      when trigger_row.oid is null then 'missing'
      else format(
        'enabled=%s; definition=%s',
        trigger_row.tgenabled,
        pg_catalog.pg_get_triggerdef(trigger_row.oid, true)
      )
    end as actual
  from expected_triggers as expected
  left join pg_catalog.pg_namespace as namespace
    on namespace.nspname = 'public'
  left join pg_catalog.pg_class as relation
    on relation.relnamespace = namespace.oid
   and relation.relname = expected.table_name
  left join pg_catalog.pg_trigger as trigger_row
    on trigger_row.tgrelid = relation.oid
   and trigger_row.tgname = expected.trigger_name
   and not trigger_row.tgisinternal
),
expected_functions(
  function_name,
  identity_arguments,
  expected_result,
  definition_pattern
) as (
  values
    ('set_updated_at', '', 'trigger',
      $$new\.updated_at = pg_catalog\.now\(\).*return new$$),
    ('enforce_job_status_transition', '', 'trigger',
      $$old\.status = 'pending'.*new\.status = 'processing'.*old\.status = 'processing'.*new\.status.*completed.*failed$$),
    ('claim_next_job', 'uuid',
      'table(id uuid, type text, prompt text, context_json jsonb)',
      $$from public\.runners as runner.*for update.*from public\.jobs as job.*status = 'pending'.*order by job\.created_at asc, job\.id asc.*for update skip locked.*status = 'processing'.*claimed_by_runner_id = p_runner_id.*started_at = pg_catalog\.now\(\).*current_job_id = v_job\.id$$),
    ('complete_runner_job', 'uuid, uuid, text', 'boolean',
      $$from public\.runners as runner.*for update.*status = 'completed'.*result_shortcode = p_result_shortcode.*completed_at = pg_catalog\.now\(\).*current_job_id = null$$),
    ('fail_runner_job', 'uuid, uuid, text', 'boolean',
      $$from public\.runners as runner.*for update.*status = 'failed'.*result_shortcode = null.*error_message = p_error_message.*completed_at = pg_catalog\.now\(\).*current_job_id = null$$)
),
function_catalog as (
  select
    expected.*,
    procedure_row.oid,
    procedure_row.proowner,
    procedure_row.proacl,
    procedure_row.prosecdef,
    procedure_row.provolatile,
    procedure_row.proconfig,
    language_row.lanname,
    lower(pg_catalog.pg_get_function_result(procedure_row.oid)) as result_type,
    pg_catalog.pg_get_functiondef(procedure_row.oid) as definition,
    lower(
      pg_catalog.regexp_replace(
        pg_catalog.pg_get_functiondef(procedure_row.oid),
        '\s+',
        ' ',
        'g'
      )
    ) as normalized_definition
  from expected_functions as expected
  left join pg_catalog.pg_namespace as namespace
    on namespace.nspname = 'public'
  left join pg_catalog.pg_proc as procedure_row
    on procedure_row.pronamespace = namespace.oid
   and procedure_row.proname = expected.function_name
   and pg_catalog.oidvectortypes(procedure_row.proargtypes) = expected.identity_arguments
  left join pg_catalog.pg_language as language_row
    on language_row.oid = procedure_row.prolang
),
function_checks as (
  select
    'functions / definitions'::text as category,
    format('public.%s(%s)', function_name, identity_arguments) as object_name,
    'signature_security_search_path_and_body'::text as check_name,
    oid is not null
      and lanname = 'plpgsql'
      and not prosecdef
      and provolatile = 'v'
      and coalesce(proconfig, array[]::text[]) = array['search_path=""']
      and result_type = expected_result
      and normalized_definition ~ definition_pattern as pass,
    format(
      'result=%s; plpgsql; SECURITY INVOKER; VOLATILE; empty search_path; migration body semantics',
      expected_result
    ) as expected,
    case
      when oid is null then 'missing'
      else format(
        'result=%s; language=%s; security=%s; volatility=%s; proconfig=%s; definition=%s',
        result_type,
        lanname,
        case when prosecdef then 'DEFINER' else 'INVOKER' end,
        provolatile,
        coalesce(pg_catalog.array_to_string(proconfig, ', '), '<none>'),
        definition
      )
    end as actual
  from function_catalog
),
function_roles(role_name) as (
  values ('public'), ('anon'), ('authenticated'), ('service_role')
),
function_privilege_checks as (
  select
    'function execute permissions'::text as category,
    format('public.%s(%s)', function_row.function_name, function_row.identity_arguments) as object_name,
    role_row.role_name::text as check_name,
    case
      when function_row.oid is null then false
      when role_row.role_name = 'public' then not exists (
        select 1
        from pg_catalog.aclexplode(
          coalesce(
            function_row.proacl,
            pg_catalog.acldefault('f', function_row.proowner)
          )
        ) as acl
        where acl.grantee = 0
          and acl.privilege_type = 'EXECUTE'
      )
      when role_row.role_name = 'service_role' then
        pg_catalog.has_function_privilege(
          role_row.role_name,
          function_row.oid,
          'EXECUTE'
        )
      else not pg_catalog.has_function_privilege(
        role_row.role_name,
        function_row.oid,
        'EXECUTE'
      )
    end as pass,
    case
      when role_row.role_name = 'service_role' then 'EXECUTE granted'
      else 'EXECUTE denied'
    end as expected,
    case
      when function_row.oid is null then 'function missing'
      when role_row.role_name = 'public' then format(
        'public_execute=%s',
        exists (
          select 1
          from pg_catalog.aclexplode(
            coalesce(
              function_row.proacl,
              pg_catalog.acldefault('f', function_row.proowner)
            )
          ) as acl
          where acl.grantee = 0
            and acl.privilege_type = 'EXECUTE'
        )
      )
      else format(
        'has_execute=%s',
        pg_catalog.has_function_privilege(
          role_row.role_name,
          function_row.oid,
          'EXECUTE'
        )
      )
    end as actual
  from function_catalog as function_row
  cross join function_roles as role_row
),
table_roles(role_name) as (
  values ('public'), ('anon'), ('authenticated'), ('service_role')
),
table_privilege_checks as (
  select
    'table permissions'::text as category,
    format('public.%I', table_row.table_name) as object_name,
    role_row.role_name::text as check_name,
    case
      when table_row.oid is null then false
      when role_row.role_name = 'public' then not exists (
        select 1
        from pg_catalog.aclexplode(
          coalesce(
            table_row.relacl,
            pg_catalog.acldefault('r', table_row.relowner)
          )
        ) as acl
        where acl.grantee = 0
          and acl.privilege_type in (
            'SELECT',
            'INSERT',
            'UPDATE',
            'DELETE',
            'TRUNCATE',
            'REFERENCES',
            'TRIGGER'
          )
      )
      when role_row.role_name = 'service_role' then
        pg_catalog.has_table_privilege(role_row.role_name, table_row.oid, 'SELECT')
        and pg_catalog.has_table_privilege(role_row.role_name, table_row.oid, 'INSERT')
        and pg_catalog.has_table_privilege(role_row.role_name, table_row.oid, 'UPDATE')
        and pg_catalog.has_table_privilege(role_row.role_name, table_row.oid, 'DELETE')
      else
        not pg_catalog.has_table_privilege(role_row.role_name, table_row.oid, 'SELECT')
        and not pg_catalog.has_table_privilege(role_row.role_name, table_row.oid, 'INSERT')
        and not pg_catalog.has_table_privilege(role_row.role_name, table_row.oid, 'UPDATE')
        and not pg_catalog.has_table_privilege(role_row.role_name, table_row.oid, 'DELETE')
        and not pg_catalog.has_table_privilege(role_row.role_name, table_row.oid, 'TRUNCATE')
        and not pg_catalog.has_table_privilege(role_row.role_name, table_row.oid, 'REFERENCES')
        and not pg_catalog.has_table_privilege(role_row.role_name, table_row.oid, 'TRIGGER')
    end as pass,
    case
      when role_row.role_name = 'service_role'
        then 'SELECT, INSERT, UPDATE, DELETE granted'
      else 'all table privileges denied'
    end as expected,
    case
      when table_row.oid is null then 'table missing'
      when role_row.role_name = 'public' then format(
        'public_data_privilege=%s',
        exists (
          select 1
          from pg_catalog.aclexplode(
            coalesce(
              table_row.relacl,
              pg_catalog.acldefault('r', table_row.relowner)
            )
          ) as acl
          where acl.grantee = 0
            and acl.privilege_type in (
              'SELECT',
              'INSERT',
              'UPDATE',
              'DELETE',
              'TRUNCATE',
              'REFERENCES',
              'TRIGGER'
            )
        )
      )
      else format(
        'select=%s; insert=%s; update=%s; delete=%s; truncate=%s; references=%s; trigger=%s',
        pg_catalog.has_table_privilege(role_row.role_name, table_row.oid, 'SELECT'),
        pg_catalog.has_table_privilege(role_row.role_name, table_row.oid, 'INSERT'),
        pg_catalog.has_table_privilege(role_row.role_name, table_row.oid, 'UPDATE'),
        pg_catalog.has_table_privilege(role_row.role_name, table_row.oid, 'DELETE'),
        pg_catalog.has_table_privilege(role_row.role_name, table_row.oid, 'TRUNCATE'),
        pg_catalog.has_table_privilege(role_row.role_name, table_row.oid, 'REFERENCES'),
        pg_catalog.has_table_privilege(role_row.role_name, table_row.oid, 'TRIGGER')
      )
    end as actual
  from table_catalog as table_row
  cross join table_roles as role_row
),
policy_checks as (
  select
    'policies'::text as category,
    'public.sites / public.runners / public.jobs'::text as object_name,
    'no_policies'::text as check_name,
    count(*) = 0 as pass,
    'zero policies'::text as expected,
    format('policy_count=%s', count(*)) as actual
  from pg_catalog.pg_policies
  where schemaname = 'public'
    and tablename in ('sites', 'runners', 'jobs')
),
claim_atomicity_check as (
  select
    'atomic claim semantics'::text as category,
    'public.claim_next_job(uuid)'::text as object_name,
    'runner_lock_oldest_pending_skip_locked_and_atomic_updates'::text as check_name,
    oid is not null
      and not prosecdef
      and provolatile = 'v'
      and coalesce(proconfig, array[]::text[]) = array['search_path=""']
      and normalized_definition ~ $$from public\.runners as runner.*for update$$
      and normalized_definition ~ $$runner\.status = 'online'$$
      and normalized_definition ~ $$runner\.last_seen_at >= pg_catalog\.now\(\).*30 seconds$$
      and normalized_definition ~ $$v_current_job_id is not null$$
      and normalized_definition ~ $$from public\.jobs as job.*job\.status = 'pending'$$
      and normalized_definition ~ $$order by job\.created_at asc, job\.id asc.*limit 1.*for update skip locked$$
      and normalized_definition ~ $$status = 'processing'.*claimed_by_runner_id = p_runner_id.*started_at = pg_catalog\.now\(\)$$
      and normalized_definition ~ $$set current_job_id = v_job\.id$$ as pass,
    'runner row lock; online/fresh/not-busy checks; oldest pending ordering; FOR UPDATE SKIP LOCKED; job and runner updates in one function'::text as expected,
    case
      when oid is null then 'function missing'
      else format(
        'runner_lock=%s; freshness=%s; busy_guard=%s; oldest_pending=%s; skip_locked=%s; job_update=%s; runner_update=%s',
        normalized_definition ~ $$from public\.runners as runner.*for update$$,
        normalized_definition ~ $$runner\.status = 'online'$$
          and normalized_definition ~ $$runner\.last_seen_at >= pg_catalog\.now\(\).*30 seconds$$,
        normalized_definition ~ $$v_current_job_id is not null$$,
        normalized_definition ~ $$from public\.jobs as job.*job\.status = 'pending'.*order by job\.created_at asc, job\.id asc$$,
        normalized_definition ~ $$for update skip locked$$,
        normalized_definition ~ $$status = 'processing'.*claimed_by_runner_id = p_runner_id.*started_at = pg_catalog\.now\(\)$$,
        normalized_definition ~ $$set current_job_id = v_job\.id$$
      )
    end as actual
  from function_catalog
  where function_name = 'claim_next_job'
    and identity_arguments = 'uuid'
),
all_checks as (
  select * from table_checks
  union all select * from constraint_checks
  union all select * from index_checks
  union all select * from trigger_checks
  union all select * from function_checks
  union all select * from function_privilege_checks
  union all select * from table_privilege_checks
  union all select * from policy_checks
  union all select * from claim_atomicity_check
),
failed_checks as (
  select * from all_checks where not pass or pass is null
),
summary as (
  select
    'summary'::text as category,
    'phase_2_schema'::text as object_name,
    'all_catalog_checks'::text as check_name,
    count(*) filter (where not pass or pass is null) = 0 as pass,
    'all checks pass'::text as expected,
    format(
      '%s checks; %s failures',
      count(*),
      count(*) filter (where not pass or pass is null)
    ) as actual
  from all_checks
)
select category, object_name, check_name, pass, expected, actual
from failed_checks
union all
select category, object_name, check_name, pass, expected, actual
from summary
order by category, object_name, check_name;
