export const geocodeCity = async (city: string): Promise<{ latitude: number; longitude: number } | null> => {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'json');
  url.searchParams.set('accept-language', 'en');
  url.searchParams.set('q', city);
  url.searchParams.set('limit', '1');

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

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      return null;
    }
    const result = data[0];
    return {
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
    };
  } catch {
    return null;
  }
};
