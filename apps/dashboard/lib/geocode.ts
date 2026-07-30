export interface GeocodeResult {
  displayName: string;
  lat: number;
  lng: number;
}

/** Address → coordinates via dashboard API (Nominatim proxied server-side). */
export async function searchAddresses(query: string): Promise<GeocodeResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  const url = new URL("/api/geocode/search", window.location.origin);
  url.searchParams.set("q", q);

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return [];

  const json = (await res.json()) as { results?: GeocodeResult[] };
  return json.results ?? [];
}

export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported in this browser"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 5000,
    });
  });
}
