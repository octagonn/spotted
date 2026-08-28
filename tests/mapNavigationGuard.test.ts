import { describe, expect, it } from "vitest";

import { allowMapNavigation } from "@/lib/mapNavigation";

/**
 * The map WebView holds a postMessage bridge into the app, so it must never be
 * able to navigate to a page we don't control. These lock that guard down.
 */
describe("allowMapNavigation", () => {
  it("allows the inline document so the map can actually render", () => {
    expect(allowMapNavigation("about:blank")).toBe(true);
    expect(allowMapNavigation("data:text/html;base64,abc")).toBe(true);
  });

  it("allows the map's own library and tile hosts, including subdomains", () => {
    expect(allowMapNavigation("https://unpkg.com/maplibre-gl@5.6.0/dist/maplibre-gl.js")).toBe(true);
    expect(allowMapNavigation("https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json")).toBe(true);
    expect(allowMapNavigation("https://a.basemaps.cartocdn.com/tiles/1/2/3.png")).toBe(true);
  });

  it("refuses navigation to anywhere else", () => {
    expect(allowMapNavigation("https://evil.example/steal")).toBe(false);
    expect(allowMapNavigation("https://openstreetmap.org/copyright")).toBe(false);
  });

  it("refuses non-https schemes", () => {
    expect(allowMapNavigation("http://unpkg.com/x.js")).toBe(false);
    expect(allowMapNavigation("file:///etc/passwd")).toBe(false);
    expect(allowMapNavigation("javascript:alert(1)")).toBe(false);
    expect(allowMapNavigation("")).toBe(false);
  });

  it("is not fooled by lookalike hosts or userinfo tricks", () => {
    // Suffix match must be on a dot boundary, not a substring.
    expect(allowMapNavigation("https://evilcartocdn.com/x")).toBe(false);
    expect(allowMapNavigation("https://cartocdn.com.evil.example/x")).toBe(false);
    // "https://unpkg.com@evil.example/" resolves to host evil.example.
    expect(allowMapNavigation("https://unpkg.com@evil.example/x")).toBe(false);
  });
});
