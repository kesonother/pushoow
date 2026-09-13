import type { GeocodeResult, GeocodingAdapter } from "@/domain/event/geocoding";

export function createNominatimGeocoder(fetchImpl: typeof fetch = fetch): GeocodingAdapter {
  return {
    isConfigured: () => true,
    async search(query: string) {
      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("q", query);
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("limit", "5");
      url.searchParams.set("addressdetails", "1");
      const response = await fetchImpl(url, {
        headers: {
          accept: "application/json",
          "user-agent": "Pushoow/0.1 (calendar events; https://pushoow.local)",
        },
      });
      if (!response.ok) return [];
      const payload = (await response.json()) as Array<{
        display_name?: string;
        lat?: string;
        lon?: string;
        address?: {
          city?: string;
          town?: string;
          village?: string;
          municipality?: string;
          country?: string;
          country_code?: string;
        };
      }>;
      return payload.flatMap((item): GeocodeResult[] => {
        const latitude = Number(item.lat);
        const longitude = Number(item.lon);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
        const city =
          item.address?.city ?? item.address?.town ?? item.address?.village ?? item.address?.municipality ?? null;
        const country = item.address?.country_code?.toUpperCase() ?? item.address?.country ?? null;
        return [
          {
            label: item.display_name ?? query,
            address: item.display_name ?? query,
            latitude,
            longitude,
            timezone: null,
            city,
            country,
          },
        ];
      });
    },
  };
}
