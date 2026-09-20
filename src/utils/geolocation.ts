export interface DetectedCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
  isFallback?: boolean;
  isWithinBangladesh?: boolean;
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
        isWithinBangladesh: withinBd
      };
    }
  } catch (error) {
    console.warn("Fallback IP location failed, using Dhaka center:", error);
  }

  return {
    latitude: BD_BOUNDS.defaultLat,
    longitude: BD_BOUNDS.defaultLng,
    accuracy: 5000,
    isFallback: true,
    isWithinBangladesh: true
  };
}

export function detectUserLocation(): Promise<DetectedCoordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      getFallbackLocation()
        .then(resolve)
        .catch(() => reject(new Error("Geolocation is not supported by your browser or device.")));
      return;
    }

    const sanitizeCoordinates = (
      position: GeolocationPosition, 
      isFallback = false
    ): DetectedCoordinates => {
      let lat = position.coords.latitude;
      let lon = position.coords.longitude;
      const acc = position.coords.accuracy;
      const withinBd = isInsideBangladesh(lat, lon);

      // If user's device/proxy reported coordinates outside Bangladesh,
      // warn in console but adjust to default Dhaka agro-center if wildly displaced
      if (!withinBd) {
        console.warn(`Detected GPS coordinates (${lat}, ${lon}) outside Bangladesh boundary. Snapping to Bangladesh central hub for agricultural accuracy.`);
      }

      return {
        latitude: withinBd ? lat : BD_BOUNDS.defaultLat,
        longitude: withinBd ? lon : BD_BOUNDS.defaultLng,
        accuracy: Math.round(acc),
        isFallback,
        isWithinBangladesh: withinBd
      };
    };

    // Step 1: Try High-Accuracy Hardware GPS (critical for live crop field / farm positioning)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve(sanitizeCoordinates(position, false));
      },
      (highAccError) => {
        console.warn("High-accuracy GPS attempt failed (code: " + highAccError.code + "), trying standard accuracy...", highAccError.message);
        
        // If user explicitly denied browser permission, do not try coarse location; propagate error
        if (highAccError.code === 1 /* PERMISSION_DENIED */) {
          reject(highAccError);
          return;
        }

        // Step 2: Try standard accuracy with a reasonable timeout
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve(sanitizeCoordinates(position, false));
          },
          (standardError) => {
            console.warn("Standard HTML5 Geolocation failed (code: " + standardError.code + "), attempting fallback IP location...", standardError.message);
            getFallbackLocation()
              .then(resolve)
              .catch(() => {
                reject(standardError);
              });
          },
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

