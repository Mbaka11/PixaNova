import type { MediaAsset, MediaType } from "@/lib/preview-types";

function detectMediaType(file: File): MediaType {
  if (file.type.startsWith("video/")) {
    return "video";
  }

  if (file.type.startsWith("image/")) {
    return "image";
  }

  const lower = file.name.toLowerCase();
  if (lower.endsWith(".mp4") || lower.endsWith(".mov")) {
    return "video";
  }

  if (
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".png") ||
    lower.endsWith(".gif")
  ) {
    return "image";
  }

  throw new Error("Format non supporte");
}

function loadImageMeta(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("Impossible de charger l'image"));
    img.src = url;
  });
}

function loadVideoMeta(url: string): Promise<{ width: number; height: number; duration: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      resolve({
        width: video.videoWidth || 1920,
        height: video.videoHeight || 1080,
        duration: Number.isFinite(video.duration) ? video.duration : 0
      });
    };
    video.onerror = () => reject(new Error("Impossible de lire la video"));
    video.src = url;
  });
}

export async function createMediaAsset(file: File): Promise<MediaAsset> {
  const mediaType = detectMediaType(file);
  const url = URL.createObjectURL(file);

  if (mediaType === "video") {
    const meta = await loadVideoMeta(url);
    return {
      id: `M-${Math.random().toString(36).slice(2, 9)}`,
      type: "video",
      url,
      name: file.name,
      mime: file.type,
      width: meta.width,
      height: meta.height,
      duration: meta.duration,
      fitMode: "contain",
      createdAt: Date.now()
    };
  }

  const imageMeta = await loadImageMeta(url);
  return {
    id: `M-${Math.random().toString(36).slice(2, 9)}`,
    type: "image",
    url,
    name: file.name,
    mime: file.type,
    width: imageMeta.width,
    height: imageMeta.height,
    fitMode: "contain",
    createdAt: Date.now()
  };
}
