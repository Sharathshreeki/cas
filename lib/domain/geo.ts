// Optional campus geo-fence (SRS §3.11). Browser location is advisory only and
// is never stored (NFR-48) — see decisions/0007-optional-geofencing.md.

export type GeoPoint = { lat: number; lng: number };
export type GeoFence = GeoPoint & { radiusMeters: number };

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in meters (haversine). */
export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function isInsideFence(point: GeoPoint, fence: GeoFence): boolean {
  return distanceMeters(point, fence) <= fence.radiusMeters;
}
