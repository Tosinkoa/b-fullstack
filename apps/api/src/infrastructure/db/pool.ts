import { Pool } from "pg";

export function createPool(): Pool {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  return new Pool({ connectionString: databaseUrl });
}
