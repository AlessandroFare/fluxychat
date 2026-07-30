import { NextResponse } from "next/server";

export interface GeocodeResult {
  displayName: string;
  lat: number;
  lng: number;
}

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const MIN_QUERY_LEN = 3;
const MAX_RESULTS = 6;

/** Server-side geocode proxy — avoids CSP connect-src blocks on Nominatim. */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < MIN_QUERY_LEN) {
    return NextResponse.json({ results: [] satisfies GeocodeResult[] });
  }

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", String(MAX_RESULTS));
  url.searchParams.set("addressdetails", "0");

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "Accept-Language": "en",
        "User-Agent": "FluxyChat/1.0 (fleet geocode; contact@fluxychat.local)",
      },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "geocode_upstream_failed", results: [] },
        { status: 502 },
      );
    }

    const rows = (await res.json()) as Array<{ display_name?: string; lat?: string; lon?: string }>;
    const results: GeocodeResult[] = rows
      .filter((row) => row.display_name && row.lat && row.lon)
      .map((row) => ({
        displayName: row.display_name!,
        lat: Number(row.lat),
        lng: Number(row.lon),
      }))
      .filter((row) => Number.isFinite(row.lat) && Number.isFinite(row.lng));

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json(
      { error: "geocode_failed", results: [] },
      { status: 502 },
    );
  }
}
