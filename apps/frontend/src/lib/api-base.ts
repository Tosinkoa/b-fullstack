/** API prefix (no trailing slash), e.g. `/api`. Set at build time via `VITE_API_BASE_URL`. */
export function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL ?? "/api"
  return raw.replace(/\/+$/, "") || "/api"
}
