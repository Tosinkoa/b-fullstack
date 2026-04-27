import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";

import type {
  CreateDeploymentInput,
  DeploymentRecord,
  DeploymentSourceType,
  DeploymentStatus,
  DeploymentsRepository,
} from "../../application/ports/deployments-repository.js";
import { deployments } from "../db/schema.js";

function mapStatus(value: string): DeploymentStatus {
  switch (value) {
    case "pending":
    case "building":
    case "deploying":
    case "running":
    case "failed":
      return value;
    default:
      return "failed";
  }
}

function mapSourceType(value: string): DeploymentSourceType {
  return value === "upload" ? "upload" : "git";
}

export class PostgresDeploymentsRepository implements DeploymentsRepository {
  private readonly db;

  constructor(pool: Pool) {
    this.db = drizzle(pool);
  }

  async create(input: CreateDeploymentInput): Promise<DeploymentRecord> {
    const [row] = await this.db
      .insert(deployments)
      .values({
        sourceType: input.sourceType,
        sourceUrl: input.sourceUrl,
        status: "pending",
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create deployment");
    }

    return {
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      sourceType: mapSourceType(row.sourceType),
      sourceUrl: row.sourceUrl,
      status: mapStatus(row.status),
      imageTag: row.imageTag,
      routePath: row.routePath,
      liveUrl: row.liveUrl,
      lastError: row.lastError,
    };
  }

  async list(): Promise<DeploymentRecord[]> {
    const rows = await this.db
      .select()
      .from(deployments)
      .orderBy(desc(deployments.createdAt));

    return rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      sourceType: mapSourceType(row.sourceType),
      sourceUrl: row.sourceUrl,
      status: mapStatus(row.status),
      imageTag: row.imageTag,
      routePath: row.routePath,
      liveUrl: row.liveUrl,
      lastError: row.lastError,
    }));
  }

  async getById(id: string): Promise<DeploymentRecord | null> {
    const [row] = await this.db
      .select()
      .from(deployments)
      .where(eq(deployments.id, id))
      .limit(1);

    if (!row) return null;

    return {
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      sourceType: mapSourceType(row.sourceType),
      sourceUrl: row.sourceUrl,
      status: mapStatus(row.status),
      imageTag: row.imageTag,
      routePath: row.routePath,
      liveUrl: row.liveUrl,
      lastError: row.lastError,
    };
  }

  async update(input: {
    id: string;
    status?: DeploymentStatus;
    imageTag?: string | null;
    routePath?: string | null;
    liveUrl?: string | null;
    lastError?: string | null;
  }): Promise<DeploymentRecord> {
    const [row] = await this.db
      .update(deployments)
      .set({
        status: input.status,
        imageTag: input.imageTag,
        routePath: input.routePath,
        liveUrl: input.liveUrl,
        lastError: input.lastError,
        updatedAt: new Date(),
      })
      .where(eq(deployments.id, input.id))
      .returning();

    if (!row) {
      throw new Error("Failed to update deployment");
    }

    return {
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      sourceType: mapSourceType(row.sourceType),
      sourceUrl: row.sourceUrl,
      status: mapStatus(row.status),
      imageTag: row.imageTag,
      routePath: row.routePath,
      liveUrl: row.liveUrl,
      lastError: row.lastError,
    };
  }
}
