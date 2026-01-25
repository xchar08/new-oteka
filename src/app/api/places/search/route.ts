import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Input Validation Schema
const SearchSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radius: z.number().min(100).max(5000).default(500), // Meters
  type: z.enum(['restaurant', 'cafe', 'grocery_store', 'gym']).default('restaurant'),
});

const GOOGLE_PLACES_API = 'https://places.googleapis.com/v1/places:searchNearby';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { lat, lng, radius, type } = SearchSchema.parse(body);

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error("Missing GOOGLE_MAPS_API_KEY");
      return NextResponse.json({ error: 'Service configuration error' }, { status: 503 });
    }

    // Call Google Places API (New V1)
    const res = await fetch(GOOGLE_PLACES_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        // Request specific fields to minimize cost/latency
        'X-Goog-FieldMask': 'places.name,places.formattedAddress,places.priceLevel,places.rating,places.userRatingCount,places.location'
      },
      body: JSON.stringify({
        includedTypes: [type],
        maxResultCount: 20,
        locationRestriction: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: radius
          }
        }
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Google Places API Error:", res.status, errText);
      return NextResponse.json({ error: 'Upstream provider error' }, { status: 502 });
    }

    const data = await res.json();
    return NextResponse.json(data);

  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid parameters', details: err.issues }, { status: 400 });
    }
    console.error("Places Search Error:", err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
