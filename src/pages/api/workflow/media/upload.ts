import type { APIRoute } from "astro";
import { files } from "@wix/media";
import { auth } from "@wix/essentials";
import { handleApiError, jsonResponse, requireApprovedSiteMember } from "../../../../lib/server/access-control";

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
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

    const contentType = (request.headers.get("content-type") ?? "")
      .split(";")[0]
      ?.trim()
      .toLowerCase() ?? "";
    let fileName = "";
    let mimeType = "";
    let fileBuffer: ArrayBuffer;

    if (contentType === "multipart/form-data") {
      // Backwards compatibility for clients deployed before the raw-body upload.
      let form: FormData;
      try {
        form = await request.formData();
      } catch (error) {
        console.warn("[article-media] Multipart request parsing failed:", {
          contentType,
          contentLength: request.headers.get("content-length"),
          errorName: error instanceof Error ? error.name : typeof error,
          errorMessage: error instanceof Error ? error.message.slice(0, 240) : "Unknown parser error",
        });
        return jsonResponse({ error: "Wix could not parse the multipart image upload. Refresh the app and try again." }, 400);
      }

      const file = form.get("file");
      if (
        !file ||
        typeof file !== "object" ||
        typeof (file as File).arrayBuffer !== "function" ||
        typeof (file as File).name !== "string" ||
        typeof (file as File).type !== "string" ||
        typeof (file as File).size !== "number"
      ) {
        return jsonResponse({ error: "Choose an image file to upload." }, 400);
      }

      fileName = (file as File).name;
      mimeType = (file as File).type.toLowerCase();
      if ((file as File).size <= 0 || (file as File).size > MAX_UPLOAD_BYTES) {
        return jsonResponse({ error: "Original article images must be 20 MB or smaller. Compress the file and try again." }, 413);
      }
      fileBuffer = await (file as File).arrayBuffer();
    } else {
      // Raw binary requests avoid multipart boundary parsing in the Wix proxy.
      const url = new URL(request.url);
      fileName = url.searchParams.get("fileName") ?? "";
      mimeType = contentType;
      if (!fileName || fileName.length > 255 || /[\\/\\u0000-\\u001f]/.test(fileName)) {
        return jsonResponse({ error: "The uploaded image filename is missing or invalid." }, 400);
      }
      const contentLength = Number(request.headers.get("content-length") ?? 0);
      if (contentLength > MAX_UPLOAD_BYTES) {
        return jsonResponse({ error: "Original article images must be 20 MB or smaller. Compress the file and try again." }, 413);
      }
      if (!ALLOWED_TYPES.has(mimeType)) {
        return jsonResponse({ error: "Send the image as JPEG, PNG, WebP, or GIF binary data." }, 415);
      }
      fileBuffer = await request.arrayBuffer();
    }

    if (!ALLOWED_TYPES.has(mimeType)) {
      return jsonResponse({ error: "Use a JPEG, PNG, WebP, or GIF image." }, 415);
    }
    if (fileBuffer.byteLength <= 0 || fileBuffer.byteLength > MAX_UPLOAD_BYTES) {
      return jsonResponse({ error: "Original article images must be 20 MB or smaller. Compress the file and try again." }, 413);
    }

    const bytes = new Uint8Array(fileBuffer);
    if (!hasValidSignature(mimeType, bytes)) {
      return jsonResponse({ error: "The file content does not match its declared image type." }, 415);
    }

    const uploadToken = crypto.randomUUID();
    const displayName = "blog-editor-" + uploadToken + "-" + safeFileName(fileName, mimeType);
    const generateUploadUrl = auth.elevate(files.generateFileUploadUrl);
    const generated = await generateUploadUrl(mimeType, { fileName: displayName, private: false });
    if (!generated.uploadUrl) {
      throw new Error("Wix Media Manager did not return an upload URL.");
    }

    const uploadResponse = await fetch(generated.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": mimeType },
      body: new Blob([fileBuffer], { type: mimeType }),
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
