import { betterAuth } from "better-auth";
import { jwt } from "better-auth/plugins";
import { mcp } from "@better-auth/mcp";
import { cimd } from "@better-auth/cimd";
import { fetchClientMetadataResource } from "@better-auth/cimd/node";
import { Pool } from "pg";

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
  apple: !!(process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET),
};

export const auth = betterAuth({
  appName: "Clupio",
  baseURL: siteOrigin,
  secret: process.env.BETTER_AUTH_SECRET,
  database: authPool(),
  emailAndPassword: { enabled: false },
  socialProviders: {
    ...(availableProviders.google
      ? { google: { clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET! } }
      : {}),
    ...(availableProviders.apple
      ? { apple: { clientId: process.env.APPLE_CLIENT_ID!, clientSecret: process.env.APPLE_CLIENT_SECRET! } }
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
