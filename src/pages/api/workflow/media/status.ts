import type { APIRoute } from "astro";
import { files } from "@wix/media";
import { auth } from "@wix/essentials";
import { handleApiError, jsonResponse, requireApprovedSiteMember } from "../../../../lib/server/access-control";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function imageMimeType(name: string): string | null {
  const extension = name.split(".").pop()?.toLowerCase();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "gif") return "image/gif";
  return null;
}

export const GET: APIRoute = async ({ request }) => {
  try {
    await requireApprovedSiteMember();
    const url = new URL(request.url);
    const fileId = url.searchParams.get("fileId") ?? "";
    const uploadToken = url.searchParams.get("uploadToken") ?? "";
    if (!fileId || fileId.length > 1000 || !/^[0-9a-f-]{36}$/i.test(uploadToken)) {
      return jsonResponse({ error: "The upload status request is invalid." }, 400);
    }

    const getFileDescriptor = auth.elevate(files.getFileDescriptor);
    const response: unknown = await getFileDescriptor(fileId);
    const root = isRecord(response) && isRecord(response.file) ? response.file : response;
    if (!isRecord(root)) throw new Error("Wix Media Manager returned an invalid file descriptor.");

    const displayName = typeof root.displayName === "string" ? root.displayName : "";
    const expectedPrefix = "blog-editor-" + uploadToken + "-";
    if (!displayName.startsWith(expectedPrefix)) {
      return jsonResponse({ error: "This image upload does not belong to the current upload session." }, 404);
    }

    const status = typeof root.operationStatus === "string" ? root.operationStatus : "PENDING";
    if (status === "FAILED") {
      return jsonResponse({ status: "FAILED", error: "Wix Media Manager could not process this image." }, 422);
    }
    if (status !== "READY") return jsonResponse({ status: "PENDING" }, 202);

    const mediaType = typeof root.mediaType === "string" ? root.mediaType : "";
    const mediaState = typeof root.state === "string" ? root.state : "";
    const mediaUrl = typeof root.url === "string" ? root.url : "";
    const id = typeof root._id === "string" ? root._id : typeof root.id === "string" ? root.id : "";
    const mimeType = imageMimeType(displayName.slice(expectedPrefix.length));
    let parsedUrl: URL | null = null;
    try {
      parsedUrl = new URL(mediaUrl);
    } catch {
      parsedUrl = null;
    }

    if (
      mediaType !== "IMAGE" ||
      mediaState !== "OK" ||
      root.private === true ||
      !id ||
      !mimeType ||
      !parsedUrl ||
      parsedUrl.protocol !== "https:" ||
      parsedUrl.hostname !== "static.wixstatic.com" ||
      !parsedUrl.pathname.startsWith("/media/")
    ) {
      return jsonResponse({ error: "Wix Media Manager did not return a usable public image." }, 422);
    }

    return jsonResponse({
      status: "READY",
      media: {
        id,
        url: parsedUrl.href,
        name: displayName.slice(expectedPrefix.length),
        mimeType,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
};
