"use client";

import Image from "next/image";
import { useState } from "react";

import { createPhotoAssetFromProcessed, validatePhotoUpload } from "@/lib/photo";
import type { PhotoAsset, PhotoCrop } from "@/lib/types";

type PhotoUploaderProps = {
  photo?: PhotoAsset | null;
  onPhotoChange: (photo: PhotoAsset) => void;
};

type PendingPhoto = {
  dataUrl: string;
  width: number;
  height: number;
  fileName: string;
  sizeBytes: number;
};

const DEFAULT_CROP: PhotoCrop = {
  x: 0,
  y: 0,
  zoom: 1,
};

const TARGET_WIDTH = 800;
const TARGET_HEIGHT = 1000;

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const loadImage = (dataUrl: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const ImageCtor = globalThis.Image;
    if (!ImageCtor) {
      reject(new Error("当前环境暂不支持图片处理。"));
      return;
    }

    const image = new ImageCtor();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("无法读取照片尺寸"));
    image.src = dataUrl;
  });

const getCenteredPortraitCrop = (width: number, height: number) => {
  const sourceAspect = width / height;
  const targetAspect = 4 / 5;

  if (sourceAspect > targetAspect) {
    const cropWidth = height * targetAspect;
    const offsetX = (width - cropWidth) / 2;
    return { sx: offsetX, sy: 0, sw: cropWidth, sh: height };
  }

  const cropHeight = width / targetAspect;
  const offsetY = (height - cropHeight) / 2;
  return { sx: 0, sy: offsetY, sw: width, sh: cropHeight };
};

const renderProcessedPhoto = async (pendingPhoto: PendingPhoto) => {
  const image = await loadImage(pendingPhoto.dataUrl);
  const crop = getCenteredPortraitCrop(image.width, image.height);
  const canvas = document.createElement("canvas");
  canvas.width = TARGET_WIDTH;
  canvas.height = TARGET_HEIGHT;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("浏览器暂不支持照片处理，请更换浏览器后重试。");
  }

  context.fillStyle = "#f3f6fb";
  context.fillRect(0, 0, TARGET_WIDTH, TARGET_HEIGHT);
  context.filter = "brightness(1.03) contrast(1.05) saturate(1.02)";
  context.drawImage(
    image,
    crop.sx,
    crop.sy,
    crop.sw,
    crop.sh,
    0,
    0,
    TARGET_WIDTH,
    TARGET_HEIGHT,
  );

  return canvas.toDataURL("image/jpeg", 0.92);
};

export function PhotoUploader({ photo, onPhotoChange }: PhotoUploaderProps) {
  const [processing, setProcessing] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const input = event.currentTarget;
    if (!file) {
      return;
    }

    setProcessing(true);

    try {
      const dataUrl = await readFileAsDataUrl(file);
      const image = await loadImage(dataUrl);
      const validation = validatePhotoUpload({
        width: image.width,
        height: image.height,
        sizeBytes: file.size,
        fileName: file.name,
      });

      if (validation.quality === "invalid") {
        setErrors(validation.errors);
        return;
      }

      const processedDataUrl = await renderProcessedPhoto({
        dataUrl,
        width: image.width,
        height: image.height,
        fileName: file.name,
        sizeBytes: file.size,
      });

      onPhotoChange(
        createPhotoAssetFromProcessed({
          sourceDataUrl: dataUrl,
          processedDataUrl,
          width: image.width,
          height: image.height,
          fileName: file.name,
          sizeBytes: file.size,
          crop: DEFAULT_CROP,
          issues: [],
        }),
      );
      setErrors([]);
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "照片处理失败"]);
    } finally {
      setProcessing(false);
      input.value = "";
    }
  };

  return (
    <section className="studio-block">
      <div className="block-heading">
        <div>
          <p className="block-kicker">Photo</p>
          <h3>证件照</h3>
        </div>
        {photo?.processingStatus === "ready" ? <span className="block-status ready">已优化</span> : null}
      </div>
      <p className="block-copy">
        上传正面人像后，系统会自动裁切成标准简历照；横向截图、翻拍卡片或主体过小的图片会被直接拦截。
      </p>
      <label className="file-trigger">
        <span>{processing ? "正在优化照片..." : "上传并自动优化"}</span>
        <input
          accept="image/*"
          className="sr-only"
          disabled={processing}
          onChange={handleFileChange}
          type="file"
        />
      </label>
      {errors.length > 0 ? (
        <ul className="inline-errors">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}
      {photo?.previewDataUrl ? (
        <div className="photo-result">
          <Image
            alt="处理后的标准简历照"
            height={136}
            src={photo.previewDataUrl}
            unoptimized
            width={108}
          />
          <p className="inline-note">当前已按样张右上角照片位的比例与尺寸完成优化。</p>
        </div>
      ) : null}
    </section>
  );
}
