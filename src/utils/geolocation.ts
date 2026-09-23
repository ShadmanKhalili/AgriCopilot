export interface DetectedCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
  isFallback?: boolean;
  isWithinBangladesh?: boolean;
  permissionDenied?: boolean;
  source?: 'gps_high' | 'gps_standard' | 'ip_fallback' | 'default_hub';
}

// Bangladesh bounding box: 20.5° N - 26.8° N, 88.0° E - 92.8° E
export const BD_BOUNDS = {
  minLat: 20.4,
  maxLat: 26.9,
  minLng: 87.8,
  maxLng: 92.9,
  defaultLat: 23.8103,
  defaultLng: 90.4125
};

export function isInsideBangladesh(lat: number, lon: number): boolean {
  return lat >= BD_BOUNDS.minLat && lat <= BD_BOUNDS.maxLat && lon >= BD_BOUNDS.minLng && lon <= BD_BOUNDS.maxLng;
}

export async function getFallbackLocation(): Promise<DetectedCoordinates> {
  try {
    const response = await fetch('/api/ip-location');
    if (!response.ok) throw new Error('IP location failed');
    const data = await response.json();
    const lat = parseFloat(data.latitude);
    const lon = parseFloat(data.longitude);
    if (!isNaN(lat) && !isNaN(lon)) {
      const withinBd = isInsideBangladesh(lat, lon);
      return { 
        latitude: withinBd ? lat : BD_BOUNDS.defaultLat, 
        longitude: withinBd ? lon : BD_BOUNDS.defaultLng,
        accuracy: data.accuracy || 1000,
        isFallback: true,
        isWithinBangladesh: withinBd,
        source: 'ip_fallback'
      };
    }
  } catch (error) {
    console.warn("Fallback IP location notice, using central agro-hub:", error);
  }

  return {
    latitude: BD_BOUNDS.defaultLat,
    longitude: BD_BOUNDS.defaultLng,
    accuracy: 5000,
    isFallback: true,
    isWithinBangladesh: true,
    source: 'default_hub'
  };
}

export interface DetectLocationOptions {
  allowFallback?: boolean;
  timeout?: number;
}

export function detectUserLocation(options: DetectLocationOptions = { allowFallback: true, timeout: 8000 }): Promise<DetectedCoordinates> {
  const allowFallback = options.allowFallback !== false;
  const timeoutMs = options.timeout || 8000;

  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      if (allowFallback) {
        getFallbackLocation().then(resolve).catch(() => {
          resolve({
            latitude: BD_BOUNDS.defaultLat,
            longitude: BD_BOUNDS.defaultLng,
            accuracy: 5000,
            isFallback: true,
            isWithinBangladesh: true,
            source: 'default_hub'
          });
        });
      } else {
        const err = new Error("Geolocation is not supported by this browser or environment.");
        (err as any).code = 2;
        reject(err);
      }
      return;
    }

    const sanitizeCoordinates = (
      position: GeolocationPosition, 
      source: 'gps_high' | 'gps_standard' = 'gps_high'
    ): DetectedCoordinates => {
      let lat = position.coords.latitude;
      let lon = position.coords.longitude;
      const acc = position.coords.accuracy;
      const withinBd = isInsideBangladesh(lat, lon);

      if (!withinBd) {
        console.warn(`Detected GPS coordinates (${lat}, ${lon}) outside Bangladesh boundary. Snapping to central agro-hub.`);
      }

      return {
        latitude: withinBd ? lat : BD_BOUNDS.defaultLat,
        longitude: withinBd ? lon : BD_BOUNDS.defaultLng,
        accuracy: Math.round(acc),
        isFallback: !withinBd,
        isWithinBangladesh: withinBd,
        source
      };
    };

    const handleFailure = (geoError: any, isDenied: boolean) => {
      const errorMsg = geoError?.message || (isDenied ? "Permission denied" : "Location unavailable");
      console.info("GPS detection note:", errorMsg);

      if (allowFallback) {
        getFallbackLocation()
          .then((fallbackCoords) => {
            resolve({
              ...fallbackCoords,
              permissionDenied: isDenied
            });
          })
          .catch(() => {
            resolve({
              latitude: BD_BOUNDS.defaultLat,
              longitude: BD_BOUNDS.defaultLng,
              accuracy: 5000,
              isFallback: true,
              isWithinBangladesh: true,
              permissionDenied: isDenied,
              source: 'default_hub'
            });
          });
      } else {
        const standardErr = new Error(errorMsg);
        (standardErr as any).code = geoError?.code || (isDenied ? 1 : 2);
        reject(standardErr);
      }
    };

    // Step 1: Try High-Accuracy Hardware GPS
    try {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve(sanitizeCoordinates(position, 'gps_high'));
        },
        (highAccError) => {
          const isDenied = highAccError?.code === 1;
          
          // If explicitly denied or in restricted iframe, do not wait for second prompt
          if (isDenied) {
            handleFailure(highAccError, true);
            return;
          }

          // Step 2: Try standard accuracy with short timeout
          try {
            navigator.geolocation.getCurrentPosition(
              (position) => {
                resolve(sanitizeCoordinates(position, 'gps_standard'));
              },
              (standardError) => {
                handleFailure(standardError, standardError?.code === 1);
              },
              { enableHighAccuracy: false, timeout: Math.min(timeoutMs, 5000), maximumAge: 60000 }
            );
          } catch (e) {
            handleFailure(e, false);
          }
        },
        { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 }
      );
    } catch (e) {
      handleFailure(e, false);
    }
  });
}

