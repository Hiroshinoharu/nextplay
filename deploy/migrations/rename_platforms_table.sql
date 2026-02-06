DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND c.relname = 'platforms'
      AND n.nspname = 'public'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND c.relname = 'platform'
      AND n.nspname = 'public'
  ) THEN
    ALTER TABLE public.platforms RENAME TO platform;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'platforms'
      AND n.nspname = 'public'
  ) AND EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND c.relname = 'platform'
      AND n.nspname = 'public'
  ) THEN
    CREATE VIEW public.platforms AS
      SELECT * FROM public.platform;
  END IF;
END$$;
