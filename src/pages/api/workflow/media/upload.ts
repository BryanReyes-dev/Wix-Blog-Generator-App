import type { APIRoute } from "astro";
import { files } from "@wix/media";
import { auth } from "@wix/essentials";
import { handleApiError, jsonResponse, requireApprovedSiteMember } from "../../../../lib/server/access-control";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasValidSignature(mimeType: string, bytes: Uint8Array): boolean {
  if (mimeType === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === "image/png") return bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10";
  if (mimeType === "image/gif") {
    const header = String.fromCharCode(...bytes.slice(0, 6));
    return header === "GIF87a" || header === "GIF89a";
  }
  if (mimeType === "image/webp") {
    return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  }
  return false;
}

function safeFileName(value: string, mimeType: string): string {
  const extension = mimeType === "image/jpeg"
    ? "jpg"
    : mimeType === "image/png"
      ? "png"
      : mimeType === "image/webp"
        ? "webp"
        : "gif";
  const base = value
    .replace(/\.[^.]*$/, "")
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 170);
  return (base || "article-image") + "." + extension;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    await requireApprovedSiteMember();

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return jsonResponse({ error: "Send a multipart form containing an image file." }, 400);
    }

    const file = form.get("file");
    if (!(file instanceof File)) return jsonResponse({ error: "Choose an image file to upload." }, 400);
    if (!ALLOWED_TYPES.has(file.type)) {
      return jsonResponse({ error: "Use a JPEG, PNG, WebP, or GIF image." }, 415);
    }
    if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
      return jsonResponse({ error: "Original article images must be 10 MB or smaller. Compress the file and try again." }, 413);
    }

    const fileBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(fileBuffer);
    if (!hasValidSignature(file.type, bytes)) {
      return jsonResponse({ error: "The file content does not match its declared image type." }, 415);
    }

    const uploadToken = crypto.randomUUID();
    const displayName = "blog-editor-" + uploadToken + "-" + safeFileName(file.name, file.type);
    const generateUploadUrl = auth.elevate(files.generateFileUploadUrl);
    const generated = await generateUploadUrl(file.type, { fileName: displayName, private: false });
    if (!generated.uploadUrl) {
      throw new Error("Wix Media Manager did not return an upload URL.");
    }

    const uploadResponse = await fetch(generated.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: new Blob([fileBuffer], { type: file.type }),
    });
    if (!uploadResponse.ok) {
      console.error("[article-media] Wix Media Manager upload failed:", { status: uploadResponse.status });
      return jsonResponse({ error: "Wix Media Manager could not accept this image. Check the Media Manager permissions and try again." }, 502);
    }

    let uploadResult: unknown;
    try {
      uploadResult = await uploadResponse.json();
    } catch {
      throw new Error("Wix Media Manager returned an unreadable upload response.");
    }
    if (!isRecord(uploadResult) || !isRecord(uploadResult.file)) {
      throw new Error("Wix Media Manager did not confirm the uploaded file.");
    }
    const fileRecord = uploadResult.file;
    const fileId = typeof fileRecord.id === "string"
      ? fileRecord.id
      : typeof fileRecord._id === "string"
        ? fileRecord._id
        : "";
    if (!fileId) throw new Error("Wix Media Manager did not return a file ID.");

    return jsonResponse({ fileId, uploadToken }, 202);
  } catch (error) {
    return handleApiError(error);
  }
};
