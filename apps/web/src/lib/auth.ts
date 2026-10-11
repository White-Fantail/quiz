import { betterAuth } from "better-auth";
import { jwt } from "better-auth/plugins";
import { mcp } from "@better-auth/mcp";
import { cimd } from "@better-auth/cimd";
import { fetchClientMetadataResource } from "@better-auth/cimd/node";
import { Pool } from "pg";
import { importPKCS8, SignJWT } from "jose";

/** The browser, REST API and MCP all identify the same Better Auth user. */
export const siteOrigin = (process.env.BETTER_AUTH_URL || process.env.PUBLIC_ORIGIN || "http://localhost:3000").replace(/\/$/, "");
export const mcpResource = siteOrigin + "/api/mcp";

const globalPool = globalThis as unknown as { clupioAuthPool?: Pool };
export function authPool(): Pool {
  if (!globalPool.clupioAuthPool) {
    globalPool.clupioAuthPool = new Pool({
      connectionString: process.env.DATABASE_URL || "postgresql://localhost:5432/clupio",
      max: 5,
    });
  }
  return globalPool.clupioAuthPool;
}

// An unavailable social provider must not render a broken sign-in button.
export const availableProviders = {
  google: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  apple: !!(process.env.APPLE_CLIENT_ID && (
    process.env.APPLE_CLIENT_SECRET ||
    (process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID && process.env.APPLE_PRIVATE_KEY)
  )),
};

async function appleClientSecret(): Promise<string> {
  if (process.env.APPLE_CLIENT_SECRET) return process.env.APPLE_CLIENT_SECRET;
  const { APPLE_CLIENT_ID: clientId, APPLE_TEAM_ID: teamId, APPLE_KEY_ID: keyId, APPLE_PRIVATE_KEY: rawKey } = process.env;
  if (!clientId || !teamId || !keyId || !rawKey) throw new Error("Apple OAuth is not configured");
  const signingKey = await importPKCS8(rawKey.replace(/\\n/g, "\n"), "ES256");
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuer(teamId).setSubject(clientId).setAudience("https://appleid.apple.com")
    .setIssuedAt(now).setExpirationTime(now + 180 * 24 * 3600).sign(signingKey);
}

export const auth = betterAuth({
  appName: "QuizDip",
  baseURL: siteOrigin,
  secret: process.env.BETTER_AUTH_SECRET,
  database: authPool(),
  emailAndPassword: { enabled: false },
  socialProviders: {
    ...(availableProviders.google
      ? { google: { clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET! } }
      : {}),
    ...(availableProviders.apple
      ? { apple: async () => ({ clientId: process.env.APPLE_CLIENT_ID!, clientSecret: await appleClientSecret() }) }
      : {}),
  },
  account: {
    encryptOAuthTokens: true,
    accountLinking: {
      enabled: true,
      disableImplicitLinking: true,
      trustedProviders: ["google", "apple"],
      // A user may explicitly link Apple's private relay address to a Google account.
      allowDifferentEmails: true,
      allowUnlinkingAll: false,
      updateUserInfoOnLink: false,
    },
  },
  plugins: [
    jwt(),
    mcp({
      loginPage: "/sign-in",
      consentPage: "/consent",
      resource: mcpResource,
      scopes: ["openid", "profile", "email", "offline_access", "mcp:tools"],
      accessTokenExpiresIn: 3600,
      // CIMD is preferred. Allow DCR only by explicitly enabling a controlled environment.
      allowDynamicClientRegistration: process.env.MCP_ENABLE_DCR === "true",
      allowUnauthenticatedClientRegistration: process.env.MCP_ENABLE_DCR === "true",
    }),
    cimd({
      fetchClientMetadataResource,
      metadataProfile: "mcp-2026-07-28",
    }),
  ],
});
