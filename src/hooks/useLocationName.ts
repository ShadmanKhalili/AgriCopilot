import { useState, useEffect } from 'react';
import { findNearestLocation } from '../utils/geoData';

// In-memory cache across hook instances and tab navigation
const locationCache = new Map<string, string>();

export function useLocationName(coords: { latitude: number; longitude: number } | null, lang: string) {
  const lat = coords?.latitude ? Number(coords.latitude.toFixed(4)) : null;
  const lon = coords?.longitude ? Number(coords.longitude.toFixed(4)) : null;

  const [locationName, setLocationName] = useState<string | null>(() => {
    if (lat === null || lon === null) return null;
    const cacheKey = `${lat}_${lon}_${lang}`;
    if (locationCache.has(cacheKey)) return locationCache.get(cacheKey)!;
    // Compute immediate exact nearest Bangladesh administrative location
    const nearest = findNearestLocation(lat, lon, lang);
    return nearest.shortName;
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (lat === null || lon === null) {
      setLocationName(null);
      return;
    }

    const cacheKey = `${lat}_${lon}_${lang}`;
    if (locationCache.has(cacheKey)) {
      setLocationName(locationCache.get(cacheKey)!);
      return;
    }

    // Immediately calculate exact local Upazila / District match
    const localMatch = findNearestLocation(lat, lon, lang);
    setLocationName(localMatch.shortName);

    let isMounted = true;
    const controller = new AbortController();
    setIsLoading(true);

    const fetchLocation = async () => {
      try {
        const response = await fetch(
          `/api/loc-lookup?latitude=${lat}&longitude=${lon}&localityLanguage=${lang}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error(`Location lookup status: ${response.status}`);
        }

        const data = await response.json();
        
        if (isMounted) {
          let resolvedName = localMatch.shortName;

          // If location is outside Bangladesh, prioritize the default localMatch (Dhaka)
          if (localMatch.isWithinBangladesh) {
            if (data.locality && data.city && data.locality !== data.city) {
              resolvedName = `${data.locality}, ${data.city}`;
            } else if (data.locality) {
              resolvedName = `${data.locality}, ${localMatch.district[lang.toLowerCase().startsWith('bn') ? 'bn_name' : 'name']}`;
            } else if (data.city) {
              resolvedName = data.city;
            } else if (data.displayName) {
              resolvedName = data.displayName;
            }
          }

          locationCache.set(cacheKey, resolvedName);
          setLocationName(resolvedName);
        }
      } catch (error: any) {
        if (error?.name === 'AbortError') return;
        
        if (isMounted) {
          locationCache.set(cacheKey, localMatch.shortName);
          setLocationName(localMatch.shortName);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchLocation();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [lat, lon, lang]);

  return { locationName, isLoading };
}

