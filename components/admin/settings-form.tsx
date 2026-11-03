"use client";

import { useState, useTransition } from "react";
import { ExternalLinkIcon, Loader2Icon, LocateFixedIcon } from "lucide-react";
import { toast } from "sonner";
import { Field, FormError } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { updateSettings } from "@/app/actions/admin";

type Settings = {
  orderingEnabled: boolean;
  minLeadMinutes: number;
  bookingDays: number;
  geofence: { enabled: boolean; lat: number; lng: number; radiusMeters: number };
};

// FR-64 (system settings & slot policy), FR-83…FR-84 (geofence policy)
export function SettingsForm({ settings }: { settings: Settings }) {
  const [orderingEnabled, setOrderingEnabled] = useState(settings.orderingEnabled);
  const [geofenceEnabled, setGeofenceEnabled] = useState(settings.geofence.enabled);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Controlled so "Use my current location" can fill them in.
  const [lat, setLat] = useState(String(settings.geofence.lat));
  const [lng, setLng] = useState(String(settings.geofence.lng));
  const [locating, setLocating] = useState(false);
  const [accuracy, setAccuracy] = useState<number | null>(null);

  function fillFromCurrentLocation() {
    if (!("geolocation" in navigator)) {
      toast.error("This browser can't share its location.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setAccuracy(Math.round(pos.coords.accuracy));
        setLocating(false);
        toast.success("Centre set to your current location. Save settings to apply it.");
      },
      (err) => {
        setLocating(false);
        toast.error(
          err.code === err.PERMISSION_DENIED
            ? "Location access was denied. Allow it for this site in your browser settings and try again."
            : err.code === err.TIMEOUT
              ? "Getting your location took too long. Try again, ideally near a window or outdoors."
              : "Your location isn't available right now. Check that location services are on.",
        );
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }

  return (
    <form
      noValidate
      className="space-y-6"
      action={(formData) =>
        startTransition(async () => {
          const result = await updateSettings({ ...Object.fromEntries(formData), orderingEnabled, geofenceEnabled });
          if (result.ok) {
            toast.success(result.message);
            setErrors({});
            setFormError(null);
          } else {
            setErrors(result.fieldErrors ?? {});
            setFormError(result.error);
          }
        })
      }
    >
      <FormError message={formError} />
      <Card>
        <CardHeader>
          <CardTitle>Ordering</CardTitle>
          <CardDescription>Pause online ordering across all stalls, for example during exams or maintenance.</CardDescription>
        </CardHeader>
        <CardContent>
          <Label className="flex items-center gap-2 font-normal">
            <Switch checked={orderingEnabled} onCheckedChange={setOrderingEnabled} /> Online ordering enabled
          </Label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pickup-slot policy</CardTitle>
          <CardDescription>
            Slots are 15 minutes long. Capacity (orders per slot) is set per stall. These rules apply to every stall.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Minimum lead time (minutes)"
            name="minLeadMinutes"
            type="number"
            min={0}
            max={240}
            defaultValue={settings.minLeadMinutes}
            errors={errors.minLeadMinutes}
            hint="How far ahead the earliest bookable slot must start."
          />
          <Field
            label="Bookable days"
            name="bookingDays"
            type="number"
            min={1}
            max={7}
            defaultValue={settings.bookingDays}
            errors={errors.bookingDays}
            hint="1 = today only, 2 = today and tomorrow, …"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Campus geo-fence</CardTitle>
          <CardDescription>
            When enabled, students must share their browser location when placing an order and be within the radius below.
            Browser location can be inaccurate or spoofed, so treat this as a convenience check, not proof of identity.
            Student locations are never stored. Stand at the centre of campus and use your current location to set the
            centre, or enter coordinates manually.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Label className="flex items-center gap-2 font-normal">
            <Switch checked={geofenceEnabled} onCheckedChange={setGeofenceEnabled} /> Restrict ordering to campus
          </Label>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label="Latitude"
              name="geofenceLat"
              type="number"
              step="any"
              value={lat}
              onChange={(e) => {
                setLat(e.target.value);
                setAccuracy(null);
              }}
              errors={errors.geofenceLat}
            />
            <Field
              label="Longitude"
              name="geofenceLng"
              type="number"
              step="any"
              value={lng}
              onChange={(e) => {
                setLng(e.target.value);
                setAccuracy(null);
              }}
              errors={errors.geofenceLng}
            />
            <Field
              label="Radius (meters)"
              name="geofenceRadiusMeters"
              type="number"
              min={50}
              defaultValue={settings.geofence.radiusMeters}
              errors={errors.geofenceRadiusMeters}
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Button type="button" variant="outline" size="sm" onClick={fillFromCurrentLocation} disabled={locating}>
              {locating ? (
                <Loader2Icon className="animate-spin" data-icon="inline-start" />
              ) : (
                <LocateFixedIcon data-icon="inline-start" />
              )}
              {locating ? "Locating…" : "Use my current location"}
            </Button>
            {lat && lng && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lng)) ? (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Check centre on map <ExternalLinkIcon className="size-3.5" aria-hidden />
              </a>
            ) : null}
            {accuracy !== null ? (
              <p className="w-full text-xs text-muted-foreground" aria-live="polite">
                Location accurate to about ±{accuracy} m.
                {accuracy > 100 ? " That's imprecise — try again outdoors or on a phone with GPS before saving." : null}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={pending}>
        {pending ? <Loader2Icon className="animate-spin" data-icon="inline-start" /> : null}
        Save settings
      </Button>
    </form>
  );
}
