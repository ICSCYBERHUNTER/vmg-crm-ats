-- Remove the retired "executive" candidate/job category from database checks.
-- Data has already been reclassified; this migration only tightens constraints.

DO $$
DECLARE
  constraint_record RECORD;
BEGIN
  IF to_regclass('public.candidates') IS NOT NULL THEN
    FOR constraint_record IN
      SELECT conname
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = 'candidates'
        AND c.contype = 'c'
        AND pg_get_constraintdef(c.oid) ILIKE '%category%'
        AND pg_get_constraintdef(c.oid) ILIKE '%executive%'
    LOOP
      EXECUTE format('ALTER TABLE public.candidates DROP CONSTRAINT %I', constraint_record.conname);
    END LOOP;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = 'candidates'
        AND c.conname = 'candidates_category_check'
    ) THEN
      ALTER TABLE public.candidates
        ADD CONSTRAINT candidates_category_check
        CHECK (
          category IS NULL OR category IN (
            'sales',
            'sales_engineering',
            'channel',
            'marketing',
            'product',
            'customer_success',
            'operations',
            'engineering',
            'other'
          )
        );
    END IF;
  END IF;

  IF to_regclass('public.job_openings') IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'job_openings'
        AND column_name = 'category'
    )
  THEN
    FOR constraint_record IN
      SELECT conname
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = 'job_openings'
        AND c.contype = 'c'
        AND pg_get_constraintdef(c.oid) ILIKE '%category%'
        AND pg_get_constraintdef(c.oid) ILIKE '%executive%'
    LOOP
      EXECUTE format('ALTER TABLE public.job_openings DROP CONSTRAINT %I', constraint_record.conname);
    END LOOP;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = 'job_openings'
        AND c.conname = 'job_openings_category_check'
    ) THEN
      ALTER TABLE public.job_openings
        ADD CONSTRAINT job_openings_category_check
        CHECK (
          category IS NULL OR category IN (
            'sales',
            'sales_engineering',
            'channel',
            'marketing',
            'product',
            'customer_success',
            'operations',
            'engineering',
            'other'
          )
        );
    END IF;
  END IF;
END $$;
