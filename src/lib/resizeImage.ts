export const CARD_ART_WIDTH = 512;
export const CARD_ART_HEIGHT = 776;
export const CARD_ART_SOURCE_SIZE = 2048;

function resizeImage(
  file: File,
  width: number,
  height: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas 2D context is not available in this browser."));
        return;
      }

      const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight);
      const drawWidth = img.naturalWidth * scale;
      const drawHeight = img.naturalHeight * scale;
      const dx = (width - drawWidth) / 2;
      const dy = (height - drawHeight) / 2;
      ctx.drawImage(img, dx, dy, drawWidth, drawHeight);

      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to encode the resized image."));
      }, "image/png");
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load the selected image."));
    };

    img.src = objectUrl;
  });
}

/**
 * Legacy Admin-card normalizer. Kept unchanged for the old baked-card workflow:
 * exactly 512 x 776, cover-fit, centered.
 */
export function resizeImageToCardArt(
  file: File,
  width = CARD_ART_WIDTH,
  height = CARD_ART_HEIGHT,
): Promise<Blob> {
  return resizeImage(file, width, height);
}

/**
 * New layered Card Builder artwork normalizer.
 * Produces the project's canonical square 2048 x 2048 raw-art source image.
 * Generated art should already be square whenever possible; non-square input
 * is cover-fit and center-cropped as a fallback.
 */
export function resizeImageToSquareCardArt(
  file: File,
  size = CARD_ART_SOURCE_SIZE,
): Promise<Blob> {
  return resizeImage(file, size, size);
}
