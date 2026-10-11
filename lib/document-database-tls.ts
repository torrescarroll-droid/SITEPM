import { isIP } from "node:net";
import { checkServerIdentity, type ConnectionOptions } from "node:tls";

/** Server-only connection policy shared by the two restricted document writers. */
export function documentDatabaseTls(url: string): false | ConnectionOptions {
  const parsed = new URL(url);
  const hostname = parsed.hostname.replace(/^\[|\]$/g, "");
  if (
    !["postgres:", "postgresql:"].includes(parsed.protocol) ||
    !hostname ||
    hostname.includes(",")
  ) {
    throw new Error("Invalid document database connection configuration.");
  }
  if (
    process.env.NODE_ENV !== "production" &&
    ["localhost", "127.0.0.1", "::1"].includes(hostname)
  ) {
    return false;
  }
  // Optional PEM trust bundle for a provider CA not in Node's system roots.
  // No URL SSL setting may override this explicit verified TLS policy.
  const ca = process.env.SITEPM_DATABASE_CA_CERT?.trim();
  return {
    rejectUnauthorized: true,
    ...(ca ? { ca } : {}),
    ...(isIP(hostname) ? {} : { servername: hostname }),
    checkServerIdentity: (_servername, certificate) =>
      checkServerIdentity(hostname, certificate),
  };
}
