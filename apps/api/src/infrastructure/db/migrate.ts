import type { Pool } from "pg";

export async function migrate(pool: Pool): Promise<void> {
  // Keep migrations intentionally tiny + explicit for this take-home.
  // (We can move to drizzle-kit migrations once the schema stabilizes.)
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    DO $$ BEGIN
      CREATE TYPE deployment_status AS ENUM (
        'pending',
        'building',
        'deploying',
        'running',
        'failed'
      );
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE deployment_source_type AS ENUM ('git', 'upload');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE TABLE IF NOT EXISTS deployments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),

      source_type deployment_source_type NOT NULL,
      source_url text,

      status deployment_status NOT NULL DEFAULT 'pending',

      image_tag text,
      route_path text,
      live_url text,
      last_error text
    );

    DO $$ BEGIN
      CREATE TYPE deployment_log_stream AS ENUM ('stdout', 'stderr', 'system');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE TABLE IF NOT EXISTS deployment_logs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      deployment_id uuid NOT NULL REFERENCES deployments (id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      stream deployment_log_stream NOT NULL,
      message text NOT NULL
    );

    CREATE INDEX IF NOT EXISTS deployment_logs_deployment_id_created_at_idx
      ON deployment_logs (deployment_id, created_at);
  `);
}
