/**
 * Hosts the map WebView document is allowed to NAVIGATE to.
 *
 * Subdomains count — Carto serves style, sprites, glyphs and tiles from several
 * *.cartocdn.com hosts — so these are matched as domain suffixes on a dot
 * boundary.
 */
export const MAP_ALLOWED_HOSTS = ["unpkg.com", "cartocdn.com"];

/**
 * Navigation guard for the map WebView.
 *
 * That WebView holds a postMessage bridge into the app, so it must never be
 * able to BECOME a page we don't control: a redirect, an attribution-link tap
 * or an injected navigation would otherwise load a foreign page that can post
 * messages to the native side.
 *
 * This only sees NAVIGATIONS — tile/script/XHR subresources don't route through
 * it — which is why the inline document (about: / data:) must be allowed
 * explicitly or the map would never render at all.
 */
export function allowMapNavigation(url: string): boolean {
  if (!url) return false;
  // The inline `source={{ html }}` document loads under about: (and data: on
  // some platforms). Blocking these would blank the map.
  if (url.startsWith("about:") || url.startsWith("data:")) return true;
  const match = /^https:\/\/([^/?#]+)/i.exec(url);
  if (!match) return false; // http://, file://, mailto:, custom schemes — refuse
  // Strip any userinfo ("https://trusted.com@evil.example/") — the real host is
  // whatever follows the last "@".
  const host = match[1].toLowerCase().split("@").pop() ?? "";
  const bare = host.split(":")[0];
  return MAP_ALLOWED_HOSTS.some((allowed) => bare === allowed || bare.endsWith(`.${allowed}`));
}
