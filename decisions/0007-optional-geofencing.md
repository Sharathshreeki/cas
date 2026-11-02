# 7. Optional, non-persistent geofencing

Status: Accepted · Requirements: FR-83–FR-86, NFR-48

## Decision

- Disabled by default. Admins enable it in *Settings* with a centre (default PES RR campus,
  12.9348, 77.5343) and radius (default 800 m).
- When enabled, checkout asks the browser for location once at submit time and sends it with the order.
  The server checks the haversine distance; it rejects `LOCATION_REQUIRED` / `OUTSIDE_CAMPUS` with an explanation.
- Coordinates are used only for this check and are **never stored or logged**.
- Denied or unavailable permission produces a specific message and blocks only ordering, not browsing.

## Consequences

Browser location can be spoofed; this is a convenience control, not identity proof (SRS §3.11).
