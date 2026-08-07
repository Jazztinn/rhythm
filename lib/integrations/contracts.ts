export const integrationStatuses = [
  "not_configured",
  "not_connected",
  "connected",
  "permission_denied",
  "token_expired",
  "rate_limited",
  "offline",
  "provider_unavailable",
] as const;

export type IntegrationStatus = (typeof integrationStatuses)[number];
export type ProviderErrorCode = Exclude<IntegrationStatus, "connected">;
export type IntegrationProvider = "google" | "slack";

export type IntegrationError = {
  code: ProviderErrorCode;
  message: string;
  retryable: boolean;
};

export type IntegrationResponse<T> = {
  status: IntegrationStatus;
  data: T | null;
  error: IntegrationError | null;
};

export function success<T>(data: T, status: IntegrationStatus = "connected"): IntegrationResponse<T> {
  return { status, data, error: null };
}

export function failure<T = never>(code: ProviderErrorCode, message: string, retryable = false): IntegrationResponse<T> {
  return { status: code, data: null, error: { code, message, retryable } };
}

export function classifyProviderResponse(status: number): ProviderErrorCode {
  if (status === 401) return "token_expired";
  if (status === 403) return "permission_denied";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "provider_unavailable";
  return "provider_unavailable";
}

export function classifyProviderError(error: unknown): ProviderErrorCode {
  if (typeof navigator !== "undefined" && !navigator.onLine) return "offline";
  if (error instanceof TypeError) return "offline";
  return "provider_unavailable";
}

export const providerMessages: Record<ProviderErrorCode, string> = {
  not_configured: "This provider is not configured for this Rhythm workspace.",
  not_connected: "Connect this provider to see its data.",
  permission_denied: "Rhythm does not have permission for that provider data.",
  token_expired: "This connection needs to be renewed.",
  rate_limited: "The provider is rate limiting requests. Try again shortly.",
  offline: "You are offline. Local tasks remain available; provider data will return online.",
  provider_unavailable: "The provider is taking a quiet moment. Try again shortly.",
};

export function responseStatus(response: Response): ProviderErrorCode | null {
  return response.ok ? null : classifyProviderResponse(response.status);
}
