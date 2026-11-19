import type { APIRoute } from "astro";
import { files } from "@wix/media";
import { auth } from "@wix/essentials";
import { handleApiError, jsonResponse, requireApprovedSiteMember } from "../../../lib/server/access-control";
import { getMediaFileInfo, getMediaFileMaxBytes } from "../../../lib/media-file-types";
import { MAX_DIRECT_UPLOAD_BYTES } from "../../../lib/media-reference-constants";

export const POST: APIRoute = async ({ request }) => {
  try {
    await requireApprovedSiteMember();

    let input: unknown;
    try {
      input = await request.json();
    } catch {
      return jsonResponse({ error: "Send valid media upload details." }, 400);
    }

    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return jsonResponse({ error: "Send valid media upload details." }, 400);
    }

    const body = input as Record<string, unknown>;
    const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "";
    const sizeBytes = body.sizeBytes;
    if (!fileName || fileName.length > 255 || /[\\/\u0000-\u001f]/.test(fileName)) {
      return jsonResponse({ error: "The media file name is invalid." }, 400);
    }
    if (typeof sizeBytes !== "number" || !Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) {
      return jsonResponse({ error: "The media file size is invalid." }, 400);
    }

    const fileInfo = getMediaFileInfo(fileName);
    if (!fileInfo) return jsonResponse({ error: "This file type is not supported by the Wix media uploader." }, 415);
    if (sizeBytes > getMediaFileMaxBytes(fileName, fileInfo.kind)) {
      return jsonResponse({ error: "This file exceeds the supported size for its media type." }, 413);
    }

    if (sizeBytes > MAX_DIRECT_UPLOAD_BYTES) {
      const generateResumableUrl = auth.elevate(files.generateFileResumableUploadUrl);
      const result = await generateResumableUrl(fileInfo.mimeType, {
        fileName,
        private: false,
        uploadProtocol: "TUS",
        filePath: "blog-generator",
      });
      return jsonResponse({
        protocol: "tus",
        uploadUrl: result.uploadUrl,
        uploadToken: result.uploadToken,
        mimeType: fileInfo.mimeType,
      });
    }

    const generateUploadUrl = auth.elevate(files.generateFileUploadUrl);
    const result = await generateUploadUrl(fileInfo.mimeType, {
      fileName,
      private: false,
      filePath: "blog-generator",
    });
    return jsonResponse({
      protocol: "direct",
      uploadUrl: result.uploadUrl,
      mimeType: fileInfo.mimeType,
    });
  } catch (error) {
    return handleApiError(error);
  }
};
