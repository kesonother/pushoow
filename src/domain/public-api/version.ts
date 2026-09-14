import {
  PUBLIC_API_DEPRECATION_MONTHS,
  PUBLIC_API_RELEASED_AT,
  PUBLIC_API_VERSION,
} from "@/domain/public-api/types";

export type VersionPolicy = {
  version: string;
  releasedAt: string;
  current: boolean;
  deprecated: boolean;
  sunsetAt: string | null;
  deprecationMonths: number;
};

const VERSIONS: VersionPolicy[] = [
  {
    version: PUBLIC_API_VERSION,
    releasedAt: PUBLIC_API_RELEASED_AT,
    current: true,
    deprecated: false,
    sunsetAt: null,
    deprecationMonths: PUBLIC_API_DEPRECATION_MONTHS,
  },
];

export function publicApiVersionPolicy(version = PUBLIC_API_VERSION): VersionPolicy {
  return VERSIONS.find((item) => item.version === version) ?? VERSIONS[0]!;
}

export function publicApiVersionHeaders(policy = publicApiVersionPolicy()): Record<string, string> {
  const headers: Record<string, string> = {
    "api-version": policy.version,
    "api-released": policy.releasedAt,
    "deprecation-policy": `${policy.deprecationMonths} months after announcement`,
  };
  if (policy.deprecated) {
    headers.deprecation = "true";
    if (policy.sunsetAt) headers.sunset = policy.sunsetAt;
    headers.link = `</docs/api>; rel="deprecation"`;
  }
  return headers;
}

export function isSupportedPublicVersion(value: string | null): boolean {
  if (!value) return true;
  return VERSIONS.some((item) => item.version === value || item.releasedAt === value);
}
