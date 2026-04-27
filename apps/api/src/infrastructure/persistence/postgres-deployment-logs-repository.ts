import { asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";

import type {
  DeploymentLogRecord,
  DeploymentLogStream,
  DeploymentLogsRepository,
} from "../../application/ports/deployment-logs-repository.js";
import { deploymentLogs } from "../db/schema.js";

function mapStream(value: string): DeploymentLogStream {
  switch (value) {
    case "stdout":
    case "stderr":
    case "system":
      return value;
    default:
      return "system";
  }
}

export class PostgresDeploymentLogsRepository implements DeploymentLogsRepository {
  private readonly db;

  constructor(pool: Pool) {
    this.db = drizzle(pool);
  }

  async append(input: {
    deploymentId: string;
    stream: DeploymentLogStream;
    message: string;
  }): Promise<DeploymentLogRecord> {
    const [row] = await this.db
      .insert(deploymentLogs)
      .values({
        deploymentId: input.deploymentId,
        stream: input.stream,
        message: input.message,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to append deployment log");
    }

    return {
      id: row.id,
      deploymentId: row.deploymentId,
      createdAt: row.createdAt.toISOString(),
      stream: mapStream(row.stream),
      message: row.message,
    };
  }

  async listForDeployment(deploymentId: string): Promise<DeploymentLogRecord[]> {
    const rows = await this.db
      .select()
      .from(deploymentLogs)
      .where(eq(deploymentLogs.deploymentId, deploymentId))
      .orderBy(asc(deploymentLogs.createdAt), asc(deploymentLogs.id));

    return rows.map((row) => ({
      id: row.id,
      deploymentId: row.deploymentId,
      createdAt: row.createdAt.toISOString(),
      stream: mapStream(row.stream),
      message: row.message,
    }));
  }
}
