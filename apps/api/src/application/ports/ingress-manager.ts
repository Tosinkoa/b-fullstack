export interface IngressManager {
  /**
   * Route an external path prefix (e.g. `/apps/<deploymentId>`) to a target
   * upstream (e.g. `http://127.0.0.1:49123`).
   */
  upsertPathRoute(input: {
    routeId: string;
    pathPrefix: string;
    upstream: string;
  }): Promise<void>;

  /**
   * Route an external host (e.g. `<deploymentId>.localhost`) to a target upstream.
   */
  upsertHostRoute(input: {
    routeId: string;
    host: string;
    upstream: string;
  }): Promise<void>;

  removeRoute(routeId: string): Promise<void>;
}

