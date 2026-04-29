export type Coordinate = {
  latitude: number;
  longitude: number;
};

const earthRadiusMeters = 6371000;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function distanceMeters(a: Coordinate, b: Coordinate) {
  const latitudeDelta = toRadians(b.latitude - a.latitude);
  const longitudeDelta = toRadians(b.longitude - a.longitude);
  const latitudeA = toRadians(a.latitude);
  const latitudeB = toRadians(b.latitude);
  const h =
    Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
    Math.cos(latitudeA) *
      Math.cos(latitudeB) *
      Math.sin(longitudeDelta / 2) *
      Math.sin(longitudeDelta / 2);
  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(h));
}

export function isInsideGeofence(point: Coordinate, center: Coordinate, radiusMeters: number) {
  return distanceMeters(point, center) <= radiusMeters;
}

export function jitterGymCoordinate(center: Coordinate, seed: string) {
  const code = seed.split("").reduce((total, letter) => total + letter.charCodeAt(0), 0);
  const angle = ((code % 360) * Math.PI) / 180;
  const meters = 8 + (code % 12);
  const latitudeOffset = (meters * Math.cos(angle)) / 111320;
  const longitudeOffset = (meters * Math.sin(angle)) / (111320 * Math.cos(toRadians(center.latitude)));
  return {
    latitude: center.latitude + latitudeOffset,
    longitude: center.longitude + longitudeOffset
  };
}
