import type { MediaKind, UploadedMedia } from "./media-reference-types";

export type WixUploadTarget =
  | { protocol: "direct"; uploadUrl: string }
  | { protocol: "tus"; uploadUrl: string; uploadToken: string };

type UploadDescriptor = {
  id?: string;
  _id?: string;
  url?: string;
  displayName?: string;
  mediaType?: string;
  thumbnailUrl?: string;
  media?: { video?: string | { video?: string } };
};

function encodeBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function parseDescriptor(response: Response): Promise<UploadDescriptor> {
  if (!response.ok) {
    throw new Error("Wix Media Manager rejected the upload. Check the file type, size, and app permissions.");
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("Wix received the upload but did not return its media details. Check the Media Manager before retrying.");
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("Wix returned an invalid media upload result.");
  }
  const root = payload as Record<string, unknown>;
  const descriptor = (root.file && typeof root.file === "object" ? root.file : root) as UploadDescriptor;
  if (typeof (descriptor.id ?? descriptor._id) !== "string") {
    throw new Error("Wix did not return a media file ID.");
  }
  return descriptor;
}

async function tusUpload(file: File, mimeType: string, target: Extract<WixUploadTarget, { protocol: "tus" }>): Promise<UploadDescriptor> {
  const metadata = [
    "filename " + encodeBase64(file.name),
    "contentType " + encodeBase64(mimeType),
    "token " + encodeBase64(target.uploadToken),
  ].join(",");

  const created = await fetch(target.uploadUrl, {
    method: "POST",
    headers: {
      "Tus-Resumable": "1.0.0",
      "Upload-Length": String(file.size),
      "Upload-Metadata": metadata,
    },
  });

  if (!created.ok) throw new Error("Wix could not start the resumable media upload.");
  const locationHeader = created.headers.get("Location");
  if (!locationHeader) throw new Error("Wix did not return a resumable upload location.");
  const uploadLocation = new URL(locationHeader, target.uploadUrl).toString();

  let offset = 0;
  const chunkSize = 8 * 1024 * 1024;

  while (offset < file.size) {
    const chunk = file.slice(offset, Math.min(file.size, offset + chunkSize));
    let patched = false;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < 4 && !patched; attempt += 1) {
      try {
        const response = await fetch(uploadLocation, {
          method: "PATCH",
          headers: {
            "Tus-Resumable": "1.0.0",
            "Upload-Offset": String(offset),
            "Content-Type": "application/offset+octet-stream",
          },
          body: chunk,
        });

        if (response.ok) {
          const nextOffset = Number(response.headers.get("Upload-Offset"));
          offset = Number.isFinite(nextOffset) && nextOffset > offset ? nextOffset : offset + chunk.size;
          patched = true;
        } else if (response.status === 409 || response.status >= 500 || response.status === 429) {
          const head = await fetch(uploadLocation, { method: "HEAD", headers: { "Tus-Resumable": "1.0.0" } });
          const remoteOffset = Number(head.headers.get("Upload-Offset"));
          if (head.ok && Number.isFinite(remoteOffset) && remoteOffset > offset) {
            offset = remoteOffset;
            patched = true;
          } else {
            lastError = new Error("The resumable upload was interrupted before Wix confirmed the next chunk.");
          }
        } else {
          throw new Error("Wix rejected a media upload chunk (HTTP " + response.status + ").");
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("The media upload was interrupted.");
      }

      if (!patched && attempt < 3) {
        await new Promise((resolve) => window.setTimeout(resolve, 500 * (attempt + 1)));
      }
    }

    if (!patched) throw lastError ?? new Error("The media upload could not be resumed.");
  }

  const finalizeUrl = target.uploadUrl.replace(/\/$/, "") + "/" + encodeURIComponent(target.uploadToken) +
    "?filename=" + encodeURIComponent(file.name);
  const finalized = await fetch(finalizeUrl, { method: "PUT" });
  return parseDescriptor(finalized);
}

export async function uploadFileToWix(
  file: File,
  mimeType: string,
  target: WixUploadTarget,
  reference: { referenceId: string; kind: MediaKind; width?: number; height?: number; durationSeconds?: number },
): Promise<UploadedMedia> {
  const descriptor = target.protocol === "tus"
    ? await tusUpload(file, mimeType, target)
    : await parseDescriptor(await fetch(target.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": mimeType },
        body: file,
      }));

  const fileId = descriptor.id ?? descriptor._id;
  const fileUrl = descriptor.url;
  if (!fileId || !fileUrl || !/^https:\/\//i.test(fileUrl)) {
    throw new Error("Wix did not return a usable media URL for " + file.name + ".");
  }

  const rawVideo = descriptor.media?.video;
  const videoUri = typeof rawVideo === "string"
    ? rawVideo
    : rawVideo && typeof rawVideo.video === "string" ? rawVideo.video : "";
  const videoMatch = /^wix:video:\/\/v1\/([^/]+)/.exec(videoUri);
  const posterMatch = /[?&#]posterUri=([^&#]+)/.exec(videoUri);
  const videoMediaId = reference.kind === "video"
    ? "video/" + (videoMatch?.[1] ?? fileId) + "/1080p/mp4/file.mp4"
    : undefined;

  return {
    referenceId: reference.referenceId,
    fileId,
    name: file.name,
    kind: reference.kind,
    mimeType,
    fileUrl,
    ...(reference.width ? { width: reference.width } : {}),
    ...(reference.height ? { height: reference.height } : {}),
    ...(reference.durationSeconds ? { durationSeconds: reference.durationSeconds } : {}),
    ...(typeof descriptor.thumbnailUrl === "string" ? { thumbnailUrl: descriptor.thumbnailUrl } : {}),
    ...(videoMediaId ? { videoMediaId } : {}),
    ...(posterMatch?.[1] ? { videoThumbnailId: "media/" + posterMatch[1] } : {}),
  };
}
