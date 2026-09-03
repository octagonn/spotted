import { describe, expect, it } from "vitest";

import { distanceMeters, isInsideGeofence } from "@/lib/geofence";

describe("geofence containment", () => {
  it("accepts points inside the gym radius", () => {
    const gym = { latitude: 40.7472, longitude: -73.9935 };
    const user = { latitude: 40.74725, longitude: -73.99354 };
    expect(distanceMeters(gym, user)).toBeLessThan(75);
    expect(isInsideGeofence(user, gym, 75)).toBe(true);
  });

  it("rejects points outside the gym radius", () => {
    const gym = { latitude: 40.7472, longitude: -73.9935 };
    const user = { latitude: 40.7572, longitude: -73.9935 };
    expect(isInsideGeofence(user, gym, 75)).toBe(false);
  });

  it("widens the fence by reported GPS accuracy", () => {
    const gym = { latitude: 40.7472, longitude: -73.9935 };
    // ~100m north of the gym: outside a bare 75m fence, inside 75m + 30m margin.
    const user = { latitude: 40.7481, longitude: -73.9935 };
    const distance = distanceMeters(gym, user);
    expect(distance).toBeGreaterThan(75);
    expect(distance).toBeLessThan(105);
    expect(isInsideGeofence(user, gym, 75)).toBe(false);
    expect(isInsideGeofence(user, gym, 75, 30)).toBe(true);
  });

  it("caps the accuracy margin at 50m", () => {
    const gym = { latitude: 40.7472, longitude: -73.9935 };
    // ~200m north: even a wildly coarse fix must not verify.
    const user = { latitude: 40.749, longitude: -73.9935 };
    expect(isInsideGeofence(user, gym, 75, 500)).toBe(false);
  });
});
