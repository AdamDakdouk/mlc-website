// Deployment-specific settings, read from the environment at call time.
// Everything has a sensible default so a fresh checkout still works.

export const DEFAULT_SITE_URL = "https://modernisticlearning.com";
const DEFAULT_EMAIL_FROM = '"Modernistic Learning Community" <info@modernisticlearning.com>';

// The site's public address, without a trailing slash. Used for the sitemap,
// robots.txt and metadata. Set SITE_URL (at build time too — those files are
// generated during `next build`).
export function getSiteUrl(): string {
  const raw = process.env.SITE_URL?.trim() || DEFAULT_SITE_URL;
  return raw.replace(/\/+$/, "");
}

// Origin to put in links that leave the app, such as the admin alert emails.
// Prefers SITE_URL; falls back to the request's own origin (right in local
// development, where SITE_URL is usually unset). Behind a hosting proxy the
// request origin can be an internal address, which is why SITE_URL wins.
export function getPublicOrigin(requestOrigin: string): string {
  const configured = process.env.SITE_URL?.trim();
  return (configured || requestOrigin).replace(/\/+$/, "");
}

// The From header for every email the site sends: `"Name" <address>`. The
// address must belong to a domain verified with the email provider, or the
// provider will reject or spam-flag the message.
export function getEmailFrom(): string {
  return process.env.EMAIL_FROM?.trim() || DEFAULT_EMAIL_FROM;
}
