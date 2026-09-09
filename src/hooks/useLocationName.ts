import { useState, useEffect } from 'react';

// In-memory cache across hook instances and tab navigation
const locationCache = new Map<string, string>();

export function useLocationName(coords: { latitude: number; longitude: number } | null, lang: string) {
  const lat = coords?.latitude ? Number(coords.latitude.toFixed(4)) : null;
  const lon = coords?.longitude ? Number(coords.longitude.toFixed(4)) : null;

  const [locationName, setLocationName] = useState<string | null>(() => {
    if (lat === null || lon === null) return null;
    const cacheKey = `${lat}_${lon}_${lang}`;
    return locationCache.get(cacheKey) || null;
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
          // Construct a readable location name
          const parts: string[] = [];
          if (data.locality) parts.push(data.locality);
          if (data.city && data.city !== data.locality) parts.push(data.city);
          if (data.principalSubdivision && !parts.includes(data.principalSubdivision)) {
            parts.push(data.principalSubdivision);
          }
          
          const result = parts.length > 0 
            ? parts.join(', ') 
            : (data.displayName || `${lat.toFixed(4)}, ${lon.toFixed(4)}`);

          locationCache.set(cacheKey, result);
          setLocationName(result);
        }
      } catch (error: any) {
        if (error?.name === 'AbortError') return;
        
        if (isMounted) {
          const fallback = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
          locationCache.set(cacheKey, fallback);
          setLocationName(fallback);
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

