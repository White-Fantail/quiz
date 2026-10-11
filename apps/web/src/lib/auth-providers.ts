/**
 * Provider availability is based on the server's configuration, not UI flags.
 * This module must remain importable without initializing Better Auth or a DB.
 */
function present(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function validAppleJwt(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const part = value.split(".")[1];
    if (!part) return false;
    const payload = JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as { exp?: unknown };
    return typeof payload.exp === "number" && payload.exp > Date.now() / 1000 + 60;
  } catch {
    return false;
  }
}

export function getAvailableProviders(env: Record<string, string | undefined>) {
  return {
    google: present(env.GOOGLE_CLIENT_ID) && present(env.GOOGLE_CLIENT_SECRET),
    apple: present(env.APPLE_CLIENT_ID) && (
      validAppleJwt(env.APPLE_CLIENT_SECRET) ||
      (present(env.APPLE_TEAM_ID) && present(env.APPLE_KEY_ID) && present(env.APPLE_PRIVATE_KEY))
    ),
  };
}

export const availableProviders = getAvailableProviders(process.env);
