export const CARD_ART_WIDTH = 512;
export const CARD_ART_HEIGHT = 776;

/**
 * Normalizes any image file to exactly CARD_ART_WIDTH x CARD_ART_HEIGHT,
 * cover-fit (scaled to fill, centered, overflow cropped) — so every card's
 * art is a consistent size on-board no matter what the admin uploads.
 */
export function resizeImageToCardArt(
  file: File,
  width = CARD_ART_WIDTH,
  height = CARD_ART_HEIGHT,
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
