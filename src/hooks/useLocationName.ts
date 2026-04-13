import { useState, useEffect } from 'react';

export function useLocationName(coords: { latitude: number; longitude: number } | null, lang: string) {
  const [locationName, setLocationName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!coords) {
      setLocationName(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    const fetchLocation = async () => {
      try {
        // Using proxy for BigDataCloud reverse geocoding API
        const response = await fetch(`/api/reverse-geocode?latitude=${coords.latitude}&longitude=${coords.longitude}&localityLanguage=${lang}`);
        const data = await response.json();
        
        if (isMounted) {
          // Construct a readable location name
          const parts = [];
          if (data.locality) parts.push(data.locality);
          if (data.city && data.city !== data.locality) parts.push(data.city);
          if (data.principalSubdivision) parts.push(data.principalSubdivision);
          
          if (parts.length > 0) {
            setLocationName(parts.join(', '));
          } else {
            setLocationName(`${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`);
          }
        }
      } catch (error) {
        console.error("Reverse geocoding failed:", error);
        if (isMounted) {
          setLocationName(`${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`);
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
    };
  }, [coords, lang]);

  return { locationName, isLoading };
}
