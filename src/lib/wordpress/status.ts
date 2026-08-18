import type { AuthenticatedSite } from "@/lib/auth/site-token";
import type { RunnerAvailability } from "@/lib/runners/availability";

export const CONTROL_SERVICE_NAME = "NCloud AI Control";

export type WordPressStatusDto = {
  connected: true;
  service: {
    name: string;
    status: "online";
    timestamp: string;
  };
  site: {
    id: string;
    name: string;
    domain: string;
    status: AuthenticatedSite["status"];
  };
  runner: {
    status: RunnerAvailability;
  };
};

/**
 * Builds the connection-screen payload.
 *
 * Only fields the plugin needs are copied across. Nothing derived from a
 * token, hash, credential, or database internal is included, and the site
 * identity comes from the authenticated record rather than the request.
 */
export function buildWordPressStatus(
  site: AuthenticatedSite,
  runner: RunnerAvailability,
  timestamp: string = new Date().toISOString(),
): WordPressStatusDto {
  return {
    connected: true,
    service: {
      name: CONTROL_SERVICE_NAME,
      status: "online",
      timestamp,
    },
    site: {
      id: site.id,
      name: site.name,
      domain: site.domain,
      status: site.status,
    },
    runner: {
      status: runner,
    },
  };
}
