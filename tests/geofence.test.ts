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
});
