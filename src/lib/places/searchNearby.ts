const GOOGLE_PLACES_API = 'https://places.googleapis.com/v1/places:searchNearby';

const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export async function searchNearbyPlaces(params: {
  lat: number;
  lng: number;
  radius: number;
  type: 'restaurant' | 'cafe' | 'grocery_store' | 'gym';
}) {
  if (!apiKey) throw new Error('Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY');

  const res = await fetch(GOOGLE_PLACES_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask':
        'places.name,places.formattedAddress,places.priceLevel,places.rating,places.userRatingCount,places.location',
    },
    body: JSON.stringify({
      includedTypes: [params.type],
      maxResultCount: 20,
      locationRestriction: {
        circle: {
          center: { latitude: params.lat, longitude: params.lng },
          radius: params.radius,
        },
      },
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    console.error('Google Places error', res.status, txt);
    throw new Error('Upstream provider error');
  }

  return res.json();
}
