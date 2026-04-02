import type { PhotoAsset, PhotoCrop, PhotoQuality } from "@/lib/types";

export type PhotoUploadResult = {
  quality: PhotoQuality;
  errors: string[];
};

export type PhotoUploadInput = {
  width: number;
  height: number;
  sizeBytes: number;
  fileName: string;
};

type CreatePhotoAssetInput = {
  sourceDataUrl: string;
  processedDataUrl: string;
  width: number;
  height: number;
  fileName: string;
  sizeBytes: number;
  crop: PhotoCrop;
  issues: string[];
};

// The flagship template prints the photo at roughly 20mm x 26mm.
// At 300 DPI, that only needs about 236 x 307 px to stay print-safe.
const MIN_WIDTH = 236;
const MIN_HEIGHT = 307;
const MIN_BYTES = 20_000;
const MAX_BYTES = 8_000_000;
const MAX_PORTRAIT_RATIO = 0.95;

export const validatePhotoUpload = ({
  width,
  height,
  sizeBytes,
}: PhotoUploadInput): PhotoUploadResult => {
  const errors: string[] = [];

  if (sizeBytes > MAX_BYTES) {
    errors.push("照片文件过大（上限 8 MB），请压缩后重新上传。");
  }

  if (width < MIN_WIDTH || height < MIN_HEIGHT) {
    errors.push(`照片清晰度不足，请上传至少 ${MIN_WIDTH}x${MIN_HEIGHT} 的证件照。`);
  }

  if (sizeBytes < MIN_BYTES) {
    errors.push("照片文件过小，打印到 PDF 后可能会发糊。");
  }

  if (width / height > MAX_PORTRAIT_RATIO) {
    errors.push("请上传正面人像，而不是横向截图或翻拍证件照。");
  }

  return {
    quality: errors.length > 0 ? "invalid" : "ready",
    errors,
  };
};

export const createPhotoAssetFromProcessed = ({
  sourceDataUrl,
  processedDataUrl,
  width,
  height,
  fileName,
  sizeBytes,
  crop,
  issues,
}: CreatePhotoAssetInput): PhotoAsset => ({
  dataUrl: sourceDataUrl,
  previewDataUrl: processedDataUrl,
  processedDataUrl,
  crop,
  aspect: 4 / 5,
  width: 800,
  height: 1000,
  sourceWidth: width,
  sourceHeight: height,
  quality: "ready",
  fileName,
  sizeBytes,
  processingStatus: "ready",
  issues,
});
