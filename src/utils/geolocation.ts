export async function getFallbackLocation(): Promise<{latitude: number, longitude: number}> {
  try {
    const response = await fetch('https://get.geojs.io/v1/ip/geo.json');
    if (!response.ok) throw new Error('IP location failed');
    const data = await response.json();
    return {
      latitude: parseFloat(data.latitude),
      longitude: parseFloat(data.longitude)
    };
  } catch (error) {
    console.error("Fallback location failed:", error);
    throw error;
  }
}

export function detectUserLocation(): Promise<{latitude: number, longitude: number}> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      getFallbackLocation()
        .then(resolve)
        .catch(() => reject(new Error("Geolocation not supported")));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
      },
      (error) => {
        console.warn("HTML5 Geolocation failed (code: " + error.code + "), trying IP fallback...", error);
        getFallbackLocation()
          .then(resolve)
          .catch(() => {
            // If fallback fails, reject with the original HTML5 error so the UI can show the right message
            reject(error);
          });
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  });
}
