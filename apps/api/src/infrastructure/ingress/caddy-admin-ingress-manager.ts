import type { IngressManager } from "../../application/ports/ingress-manager.js";

type CaddyAdminIngressManagerOptions = {
  adminBaseUrl: string; // e.g. http://caddy:2019
  /** Caddy HTTP app server id from adapted config (default site is usually `srv0`). */
  httpServerId?: string;
};

/**
 * Minimal Caddy Admin API integration.
 *
 * Strategy:
 * - Keep the static Caddyfile for core routing (/api, frontend).
 * - Insert per-deployment routes at the front of `routes` so they win over the SPA catch-all.
 */
export class CaddyAdminIngressManager implements IngressManager {
  private readonly adminBaseUrl: string;
  private readonly httpServerId: string;

  constructor(options: CaddyAdminIngressManagerOptions) {
    this.adminBaseUrl = options.adminBaseUrl.replace(/\/+$/, "");
    this.httpServerId = (options.httpServerId ?? "srv0").trim() || "srv0";
  }

  async upsertPathRoute(input: {
    routeId: string;
    pathPrefix: string;
    upstream: string;
  }): Promise<void> {
    if (!input.routeId.trim()) {
      throw new Error("routeId is required");
    }
    if (!input.pathPrefix.trim()) {
      throw new Error("pathPrefix is required");
    }
    if (!input.upstream.trim()) {
      throw new Error("upstream is required");
    }

    const rawPrefix = input.pathPrefix.startsWith("/")
      ? input.pathPrefix
      : `/${input.pathPrefix}`;
    // Caddy 2: use `/a` and `/a/*` (slash before *). A lone `/a*`-style pattern is easy to
    // mis-match; missing this route falls through to the SPA and shows Vite "Not Found".
    const normalizedPrefix = rawPrefix.replace(/\/+$/, "") || "/";

    const pathPatterns = [normalizedPrefix, `${normalizedPrefix}/`, `${normalizedPrefix}/*`];

    const body = {
      "@id": input.routeId,
      match: [{ path: pathPatterns }],
      handle: [
        {
          handler: "rewrite",
          strip_path_prefix: normalizedPrefix,
        },
        {
          handler: "reverse_proxy",
          upstreams: [{ dial: stripHttpScheme(input.upstream) }],
        },
      ],
    };

    // Caddy indexes `@id` only after the object exists in config. Append-or-replace flow:
    // 1) DELETE /id/<routeId> (404 if first deploy)
    // 2) PUT /config/.../routes/0 to insert *before* catch-all routes from the Caddyfile
    await caddyRequest(`${this.adminBaseUrl}/id/${encodeURIComponent(input.routeId)}`, {
      method: "DELETE",
      ignoreStatuses: [404],
    });

    await caddyRequest(
      `${this.adminBaseUrl}/config/apps/http/servers/${this.httpServerId}/routes/0`,
      { method: "PUT", body },
    );
  }

  async upsertHostRoute(input: {
    routeId: string;
    host: string;
    upstream: string;
  }): Promise<void> {
    if (!input.routeId.trim()) {
      throw new Error("routeId is required");
    }
    const host = input.host.trim();
    if (!host) {
      throw new Error("host is required");
    }
    if (!input.upstream.trim()) {
      throw new Error("upstream is required");
    }

    const body = {
      "@id": input.routeId,
      match: [{ host: [host] }],
      handle: [
        {
          handler: "reverse_proxy",
          upstreams: [{ dial: stripHttpScheme(input.upstream) }],
        },
      ],
    };

    await caddyRequest(`${this.adminBaseUrl}/id/${encodeURIComponent(input.routeId)}`, {
      method: "DELETE",
      ignoreStatuses: [404],
    });

    await caddyRequest(
      `${this.adminBaseUrl}/config/apps/http/servers/${this.httpServerId}/routes/0`,
      { method: "PUT", body },
    );
  }

  async removeRoute(routeId: string): Promise<void> {
    await caddyRequest(`${this.adminBaseUrl}/id/${encodeURIComponent(routeId)}`, {
      method: "DELETE",
      ignoreStatuses: [404],
    });
  }
}

function stripHttpScheme(value: string): string {
  return value.replace(/^https?:\/\//, "");
}

async function caddyRequest(
  url: string,
  input: { method: string; body?: unknown; ignoreStatuses?: number[] },
): Promise<void> {
  const headers: Record<string, string> = {
    // Caddy's Admin API enforces the Origin header when bound to non-loopback addresses.
    Origin: "http://api:3000",
  };
  if (input.body) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    method: input.method,
    headers,
    body: input.body ? JSON.stringify(input.body) : undefined,
  });

  if (res.ok) return;
  if (input.ignoreStatuses?.includes(res.status)) return;

  const text = await res.text().catch(() => "");
  throw new Error(
    `Caddy Admin API request failed (${res.status}): ${text || res.statusText}`,
  );
}

