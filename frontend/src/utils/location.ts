export const reverseGeocodeCity = async (latitude: number, longitude: number): Promise<string | null> => {
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('accept-language', 'en');
  url.searchParams.set('lat', String(latitude));
  url.searchParams.set('lon', String(longitude));
  url.searchParams.set('zoom', '10');
  url.searchParams.set('addressdetails', '1');

  try {
    const response = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'en',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json() as {
      address?: {
        city?: string;
        town?: string;
        village?: string;
        municipality?: string;
        county?: string;
        state?: string;
        country?: string;
      };
    };

    const address = data.address;
    if (!address) {
      return null;
    }

    return address.city
      || address.town
      || address.village
      || address.municipality
      || address.county
      || address.state
      || address.country
      || null;
  } catch {
    return null;
  }
};

export const formatDistanceKm = (distanceKm?: number | null): string => {
  if (distanceKm == null || !Number.isFinite(distanceKm)) {
    return 'Distance unavailable';
  }

  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m away`;
  }

  if (distanceKm < 10) {
    return `${distanceKm.toFixed(1)} km away`;
  }

  return `${Math.round(distanceKm)} km away`;
};
