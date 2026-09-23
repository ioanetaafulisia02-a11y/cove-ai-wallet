export function env(key: string): string | undefined {
  const v = process.env[key]?.trim();
  return v || undefined;
}

function firstEnv(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = env(key);
    if (value) return value;
  }
  return undefined;
}

/** xAI / Grok chat key — server only. Never expose as VITE_*. */
export function getXaiApiKey(): string | undefined {
  return firstEnv("XAI_API_KEY", "API_KEY", "GROK_API_KEY");
}

/**
 * Trust Wallet Agent Kit access id (portal.trustwallet.com).
 * Accepts TWAK_ACCESS_ID or AGENT_KIT_ID.
 */
export function getTwakAccessId(): string | undefined {
  return firstEnv("TWAK_ACCESS_ID", "TWAK_AGENT_KIT_ID", "AGENT_KIT_ID", "TRUST_WALLET_ACCESS_ID");
}

/** HMAC secret paired with the Agent Kit access id. Server only. */
export function getTwakHmacSecret(): string | undefined {
  return firstEnv("TWAK_HMAC_SECRET", "TWAK_API_SECRET", "TWAK_SECRET", "TRUST_WALLET_HMAC_SECRET");
}

export function twakCredentials(): { accessId: string; hmacSecret: string } | null {
  const accessId = getTwakAccessId();
  const hmacSecret = getTwakHmacSecret();
  if (!accessId || !hmacSecret) return null;
  return { accessId, hmacSecret };
}

/**
 * Workspace preview vs deployed app. The deployer writes GROK_PROJECT_ID on
 * every publish; the sandbox preview never has it. Single source of truth for
 * the split — gate audience, gate endpoints and connector-token semantics all
 * key off this predicate.
 */
export function isWorkspacePreview(): boolean {
  return !env("GROK_PROJECT_ID");
}
