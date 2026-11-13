import {
  ACCEPTED_IMAGE_TYPES,
  ACCEPTED_VIDEO_TYPES,
  MAX_SINGLE_FRAME_CHARS,
} from './media-reference-constants';
import type { MediaFrame } from './media-reference-types';

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function waitForEvent(
  target: EventTarget,
  successEvent: string,
  errorEvent: string,
  timeoutMs = 12_000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => finish(new Error("Timed out while reading the media file.")), timeoutMs);
    const onSuccess = () => finish();
    const onError = () => finish(new Error("This media file could not be decoded in your browser."));

    const finish = (error?: Error) => {
      window.clearTimeout(timer);
      target.removeEventListener(successEvent, onSuccess);
      target.removeEventListener(errorEvent, onError);
      if (error) reject(error);
      else resolve();
    };

    target.addEventListener(successEvent, onSuccess, { once: true });
    target.addEventListener(errorEvent, onError, { once: true });
  });
}

function canvasJpeg(source: CanvasImageSource, width: number, height: number, label: string): MediaFrame {
  const maxDimension = 1440;
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  const baseWidth = Math.max(1, Math.round(width * scale));
  const baseHeight = Math.max(1, Math.round(height * scale));
  const dimensionScales = [1, 0.82, 0.68, 0.55];
  const qualities = [0.78, 0.65, 0.52];

  for (const dimensionScale of dimensionScales) {
    const outputWidth = Math.max(1, Math.round(baseWidth * dimensionScale));
    const outputHeight = Math.max(1, Math.round(baseHeight * dimensionScale));
    const canvas = document.createElement("canvas");
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser could not prepare this image.");

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, outputWidth, outputHeight);
    context.drawImage(source, 0, 0, outputWidth, outputHeight);

    for (const quality of qualities) {
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      if (dataUrl.length <= MAX_SINGLE_FRAME_CHARS) return { label, dataUrl };
    }
  }

  throw new Error("This image is too detailed to attach. Try a smaller image.");
}

export async function imageReference(file: File): Promise<MediaFrame> {
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();

  try {
    const loaded = waitForEvent(image, "load", "error");
    image.src = objectUrl;
    await loaded;
    return canvasJpeg(image, image.naturalWidth, image.naturalHeight, "Image");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function videoReferenceFrames(file: File, maxFrames: number): Promise<MediaFrame[]> {
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;

  try {
    const metadataLoaded = waitForEvent(video, "loadedmetadata", "error");
    video.src = objectUrl;
    video.load();
    await metadataLoaded;

    if (!Number.isFinite(video.duration) || video.duration <= 0 || !video.videoWidth || !video.videoHeight) {
      throw new Error("This video has no readable visual frames.");
    }

    const positions = [0.18, 0.5, 0.82].slice(0, Math.max(1, Math.min(3, maxFrames)));
    const frames: MediaFrame[] = [];

    for (const position of positions) {
      const time = Math.max(0, Math.min(video.duration - 0.08, video.duration * position));

      if (Math.abs(video.currentTime - time) > 0.02) {
        const seeked = waitForEvent(video, "seeked", "error");
        video.currentTime = time;
        await seeked;
      }

      frames.push(canvasJpeg(video, video.videoWidth, video.videoHeight, "Frame at " + Math.round(position * 100) + "%"));
    }

    return frames;
  } finally {
    video.pause();
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(objectUrl);
  }
}

export function getMediaKind(file: File): "image" | "video" | null {
  const extension = file.name.toLowerCase().split(".").pop() ?? "";
  const mimeType = file.type.toLowerCase();

  if (ACCEPTED_IMAGE_TYPES.has(mimeType) || ["jpg", "jpeg", "png", "webp", "gif"].includes(extension)) {
    return "image";
  }

  if (ACCEPTED_VIDEO_TYPES.has(mimeType) || ["mp4", "webm", "mov"].includes(extension)) {
    return "video";
  }

  return null;
}
