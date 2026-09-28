import "server-only";
import { SERVICE_PROVIDERS, parseServiceStatus, type ServiceReport } from "./admin-service-status";
export async function loadServiceStatus(): Promise<ServiceReport[]> {
  return Promise.all(SERVICE_PROVIDERS.map(async ([name, purpose, url]) => {
    const checkedAt = new Date().toISOString();
    try {
      const response = await fetch(`${url}${name === "OpenAI" ? "/api/v2/components.json" : "/api/v2/summary.json"}`, { signal: AbortSignal.timeout(6000), next: { revalidate: 60 } });
      if (!response.ok) throw new Error("Status feed unavailable");
      return { name, purpose, url, checkedAt, ...parseServiceStatus(await response.json(), name) };
    } catch {
      return { name, purpose, url, checkedAt, state: "unknown", details: ["Could not check the provider status feed."] };
    }
  }));
}
