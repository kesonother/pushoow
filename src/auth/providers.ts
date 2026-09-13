export const OAUTH_PROVIDERS = [
  "google",
  "github",
  "apple",
  "linkedin",
  "discord",
] as const;

export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

function credentials(provider: OAuthProvider) {
  const prefix = provider.toUpperCase();
  const clientId = process.env[`${prefix}_CLIENT_ID`];
  const clientSecret = process.env[`${prefix}_CLIENT_SECRET`];
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function enabledOAuthProviders(): OAuthProvider[] {
  return OAUTH_PROVIDERS.filter((provider) => credentials(provider));
}

export function socialProvidersConfig() {
  const config: Partial<
    Record<OAuthProvider, { clientId: string; clientSecret: string }>
  > = {};
  for (const provider of OAUTH_PROVIDERS) {
    const pair = credentials(provider);
    if (pair) config[provider] = pair;
  }
  return config;
}
