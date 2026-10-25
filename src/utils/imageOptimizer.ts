/**
 * Image preparation for uploaded photos.
 *
 * The old default was 800px on the long edge at JPEG quality 0.8. Gemini
 * tiles images at 768px, so an 800px photo was already reduced to roughly one
 * tile — and the 0.8 quantisation then threw away exactly the fine texture
 * (speckling, necrotic edges, mould growth) that a leaf-disease diagnosis
 * depends on.
 *
 * 1280px at 0.85 keeps two 768px tiles' worth of detail and keeps the
 * colour transitions the model uses to tell chlorosis from necrosis.
 */
export const resizeImage = (file: File, maxWidth: number = 1280): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        let width = img.width;
        let height = img.height;

        // Never upscale: a 640px phone photo stretched to 1280px gains no
        // detail and only costs bytes.
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Compress to JPEG with 0.85 quality
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve(dataUrl);
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};
