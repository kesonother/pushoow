export type GeocodeResult = {
  label: string;
  address: string;
  latitude: number;
  longitude: number;
  timezone: string | null;
  city: string | null;
  country: string | null;
};

export type GeocodingAdapter = {
  isConfigured: () => boolean;
  search: (query: string) => Promise<GeocodeResult[]>;
};

export type TimezoneLookupAdapter = {
  isConfigured: () => boolean;
  lookup: (latitude: number, longitude: number) => Promise<string | null>;
};

export const unconfiguredTimezoneLookup: TimezoneLookupAdapter = {
  isConfigured: () => false,
  async lookup() {
    return null;
  },
};

export function mapUrl(latitude: number | null, longitude: number | null, address?: string | null) {
  if (latitude != null && longitude != null && Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return `https://www.openstreetmap.org/#map=16/${latitude}/${longitude}`;
  }
  if (address) {
    return `https://www.openstreetmap.org/search?query=${encodeURIComponent(address)}`;
  }
  return null;
}

export function mapEmbedUrl(latitude: number | null, longitude: number | null) {
  if (latitude == null || longitude == null || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  const delta = 0.01;
  return mapEmbedBbox(
    {
      west: longitude - delta,
      south: latitude - delta,
      east: longitude + delta,
      north: latitude + delta,
    },
    { latitude, longitude },
  );
}

export function mapEmbedBbox(
  bbox: { west: number; south: number; east: number; north: number },
  marker?: { latitude: number; longitude: number },
) {
  const box = `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`;
  const markerQuery =
    marker && Number.isFinite(marker.latitude) && Number.isFinite(marker.longitude)
      ? `&marker=${marker.latitude}%2C${marker.longitude}`
      : "";
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(box)}&layer=mapnik${markerQuery}`;
}
