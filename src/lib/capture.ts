export async function captureVideoFrame(
  videoElement: HTMLVideoElement
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas context');

  ctx.drawImage(videoElement, 0, 0);

  // Use JPEG with 0.8 quality to save ~70% storage space
  return canvas.toDataURL('image/jpeg', 0.8);
}

/**
 * Merges two images by compositing the annotation layer on top of the base image
 * @param baseImageData - The base camera frame (data URL)
 * @param annotationImageData - The annotation canvas (data URL with transparency)
 * @returns Promise resolving to merged image data URL
 */
export async function mergeImages(
  baseImageData: string,
  annotationImageData: string | null
): Promise<string> {
  // If no annotations, just return the base image
  if (!annotationImageData) {
    return baseImageData;
  }

  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Failed to get canvas context'));
      return;
    }

    const baseImg = new Image();
    baseImg.onload = () => {
      canvas.width = baseImg.width;
      canvas.height = baseImg.height;

      // Draw base image
      ctx.drawImage(baseImg, 0, 0);

      // Draw annotations on top
      const annotationsImg = new Image();
      annotationsImg.onload = () => {
        // Scale annotations to match base image size
        ctx.drawImage(annotationsImg, 0, 0, baseImg.width, baseImg.height);
        // Use JPEG with 0.8 quality for smaller file size
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      annotationsImg.onerror = reject;
      annotationsImg.src = annotationImageData;
    };
    baseImg.onerror = reject;
    baseImg.src = baseImageData;
  });
}

export function downloadImage(dataUrl: string, filename: string) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

export function generateThumbnail(dataUrl: string, maxSize = 200): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      const ratio = Math.min(maxSize / img.width, maxSize / img.height);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/**
 * Download a video blob as a file
 */
export function downloadVideo(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = filename;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Convert video blob to data URL for localStorage
 * Note: Videos can be large - consider size limits
 */
export function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
