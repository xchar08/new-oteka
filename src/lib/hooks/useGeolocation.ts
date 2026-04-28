'use client';

import { useState, useEffect, useCallback } from 'react';

interface LocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  error: string | null;
  loading: boolean;
  permissionStatus: 'granted' | 'denied' | 'prompt' | 'unknown';
}

const defaultState: LocationState = {
  latitude: null,
  longitude: null,
  accuracy: null,
  error: null,
  loading: false,
  permissionStatus: 'unknown',
};

export function useGeolocation() {
  const [location, setLocation] = useState<LocationState>(defaultState);

  const checkPermission = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.permissions) {
      return 'unknown';
    }
    
    try {
      const permission = await navigator.permissions.query({ name: 'geolocation' });
      return permission.state as 'granted' | 'denied' | 'prompt';
    } catch {
      return 'unknown';
    }
  }, []);

  useEffect(() => {
    checkPermission().then(status => {
      setLocation(prev => ({ ...prev, permissionStatus: status }));
    });
  }, [checkPermission]);

  const requestLocation = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocation(prev => ({ 
        ...prev, 
        error: 'Geolocation not supported', 
        permissionStatus: 'denied' 
      }));
      return;
    }

    setLocation(prev => ({ ...prev, loading: true, error: null }));

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000, // 5 minutes cache
        });
      });

      setLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        error: null,
        loading: false,
        permissionStatus: 'granted',
      });
    } catch (err: any) {
      let errorMessage = 'Location request failed';
      let permissionStatus: LocationState['permissionStatus'] = 'denied';

      if (err.code === err.PERMISSION_DENIED) {
        errorMessage = 'Location permission denied';
        permissionStatus = 'denied';
      } else if (err.code === err.TIMEOUT) {
        errorMessage = 'Location request timed out';
      } else if (err.code === err.POSITION_UNAVAILABLE) {
        errorMessage = 'Location unavailable';
      }

      setLocation(prev => ({ 
        ...prev, 
        error: errorMessage, 
        loading: false,
        permissionStatus,
      }));
    }
  }, []);

  const clearLocation = useCallback(() => {
    setLocation(defaultState);
  }, []);

  return {
    ...location,
    requestLocation,
    clearLocation,
    hasLocation: location.latitude !== null && location.longitude !== null,
  };
}

export async function getNearbyPlacesContext(lat: number, lng: number): Promise<string> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  
  if (!apiKey) {
    return '';
  }

  try {
    const response = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.name,places.primaryType',
      },
      body: JSON.stringify({
        includedTypes: ['restaurant', 'fast_food_restaurant', 'cafe', 'food_court'],
        maxResultCount: 5,
        locationRestriction: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: 100, // 100 meters
          },
        },
      }),
    });

    if (!response.ok) {
      return '';
    }

    const data = await response.json();
    const places = data.places || [];
    
    if (places.length === 0) {
      return '';
    }

    const placeNames = places
      .map((p: any) => p.name)
      .filter((n: string) => n)
      .join(', ');

    return `Nearby food places: ${placeNames}.`;
  } catch (err) {
    console.warn('Failed to fetch nearby places:', err);
    return '';
  }
}