import { apiFetch } from "../../../../../lib/client/api";
import type { ArticleMedia } from "../../../../../lib/article-document";

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isImageMimeType(value: string): value is ArticleMedia["mimeType"] {
  return value === "image/jpeg" || value === "image/png" || value === "image/webp" || value === "image/gif";
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function imageDimensions(file: File): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const dimensions = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  if (dimensions.width < 1 || dimensions.height < 1 || dimensions.width > 20000 || dimensions.height > 20000) {
    throw new Error("This image has unsupported dimensions.");
  }
  return dimensions;
}

function validateUploadResponse(value: unknown): { fileId: string; uploadToken: string } {
  if (!isRecord(value) || typeof value.fileId !== "string" || typeof value.uploadToken !== "string") {
    throw new Error("Wix Media Manager returned an invalid upload response.");
  }
  return { fileId: value.fileId, uploadToken: value.uploadToken };
}

/**
 * Uploads the original image (not the compressed AI preview frame) to the
 * site's Wix Media Manager and waits until Wix confirms it is ready to embed.
 */
export async function uploadOriginalImage(file: File): Promise<ArticleMedia> {
  if (!isImageMimeType(file.type)) throw new Error("Use a JPEG, PNG, WebP, or GIF image.");
  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
    throw new Error("Original images must be 20 MB or smaller. Compress the file before uploading.");
  }

  const dimensions = await imageDimensions(file);
  const uploadUrl = new URL("/api/workflow/media/upload", window.location.origin);
  uploadUrl.searchParams.set("fileName", file.name);
  const uploadResponse = await apiFetch(uploadUrl.pathname + uploadUrl.search, {
    method: "POST",
    headers: { "Content-Type": file.type },
    body: file,
  });
  const uploadPayload = await readJson(uploadResponse);
  if (!uploadResponse.ok) {
    const message = isRecord(uploadPayload) && typeof uploadPayload.error === "string"
      ? uploadPayload.error
      : "Wix Media Manager could not upload this image.";
    throw new Error(message);
  }

  const { fileId, uploadToken } = validateUploadResponse(uploadPayload);
  const query = new URLSearchParams({ fileId, uploadToken });

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const statusResponse = await apiFetch("/api/workflow/media/status?" + query.toString());
    const statusPayload = await readJson(statusResponse);
    if (!statusResponse.ok && statusResponse.status !== 202) {
      const message = isRecord(statusPayload) && typeof statusPayload.error === "string"
        ? statusPayload.error
        : "Wix Media Manager could not confirm that the image is ready.";
      throw new Error(message);
    }
    if (isRecord(statusPayload) && statusPayload.status === "FAILED") {
      throw new Error(typeof statusPayload.error === "string" ? statusPayload.error : "Wix Media Manager failed to process this image.");
    }
    if (isRecord(statusPayload) && statusPayload.status === "READY" && isRecord(statusPayload.media)) {
      const media = statusPayload.media;
      if (
        typeof media.id !== "string" ||
        typeof media.url !== "string" ||
        typeof media.name !== "string" ||
        media.mimeType !== file.type
      ) {
        throw new Error("Wix Media Manager returned incomplete image details.");
      }
      return {
        id: media.id,
        url: media.url,
        name: file.name,
        mimeType: file.type,
        uploadToken,
        width: dimensions.width,
        height: dimensions.height,
      };
    }
    await new Promise<void>((resolve) => window.setTimeout(resolve, 900));
  }

  throw new Error("Wix is still processing this image. Remove it and try again in a moment.");
}
