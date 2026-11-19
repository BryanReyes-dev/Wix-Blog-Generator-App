import type { MediaKind } from "./media-reference-types";

const FILE_TYPES: Record<string, { kind: MediaKind; mimeType: string }> = {
  // Images supported by Wix Media Manager.
  jpg: { kind: "image", mimeType: "image/jpeg" },
  jpeg: { kind: "image", mimeType: "image/jpeg" },
  jpe: { kind: "image", mimeType: "image/jpeg" },
  jfif: { kind: "image", mimeType: "image/jpeg" },
  png: { kind: "image", mimeType: "image/png" },
  gif: { kind: "image", mimeType: "image/gif" },
  bmp: { kind: "image", mimeType: "image/bmp" },
  webp: { kind: "image", mimeType: "image/webp" },
  heic: { kind: "image", mimeType: "image/heic" },
  heif: { kind: "image", mimeType: "image/heif" },
  tif: { kind: "image", mimeType: "image/tiff" },
  tiff: { kind: "image", mimeType: "image/tiff" },
  avif: { kind: "image", mimeType: "image/avif" },
  svg: { kind: "image", mimeType: "image/svg+xml" },
  // Common video formats supported by Wix Video.
  mp4: { kind: "video", mimeType: "video/mp4" },
  m4v: { kind: "video", mimeType: "video/mp4" },
  mov: { kind: "video", mimeType: "video/quicktime" },
  webm: { kind: "video", mimeType: "video/webm" },
  avi: { kind: "video", mimeType: "video/x-msvideo" },
  mkv: { kind: "video", mimeType: "video/x-matroska" },
  mpg: { kind: "video", mimeType: "video/mpeg" },
  mpeg: { kind: "video", mimeType: "video/mpeg" },
  mpe: { kind: "video", mimeType: "video/mpeg" },
  ogv: { kind: "video", mimeType: "video/ogg" },
  wmv: { kind: "video", mimeType: "video/x-ms-wmv" },
  "3gp": { kind: "video", mimeType: "video/3gpp" },
  vob: { kind: "video", mimeType: "video/mpeg" },
  divx: { kind: "video", mimeType: "video/x-msvideo" },
  xvid: { kind: "video", mimeType: "video/x-msvideo" },
  mxf: { kind: "video", mimeType: "application/mxf" },
  // Audio.
  mp3: { kind: "audio", mimeType: "audio/mpeg" },
  wav: { kind: "audio", mimeType: "audio/wav" },
  m4a: { kind: "audio", mimeType: "audio/mp4" },
  aac: { kind: "audio", mimeType: "audio/aac" },
  flac: { kind: "audio", mimeType: "audio/flac" },
  wma: { kind: "audio", mimeType: "audio/x-ms-wma" },
  aif: { kind: "audio", mimeType: "audio/aiff" },
  aiff: { kind: "audio", mimeType: "audio/aiff" },
  // Documents and archives are retained as downloadable attachments.
  pdf: { kind: "document", mimeType: "application/pdf" },
  txt: { kind: "document", mimeType: "text/plain" },
  csv: { kind: "document", mimeType: "text/csv" },
  rtf: { kind: "document", mimeType: "application/rtf" },
  doc: { kind: "document", mimeType: "application/msword" },
  docx: { kind: "document", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  ppt: { kind: "document", mimeType: "application/vnd.ms-powerpoint" },
  pptx: { kind: "document", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation" },
  xls: { kind: "document", mimeType: "application/vnd.ms-excel" },
  xlsx: { kind: "document", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  zip: { kind: "document", mimeType: "application/zip" },
  "7z": { kind: "document", mimeType: "application/x-7z-compressed" },
  rar: { kind: "document", mimeType: "application/vnd.rar" },
};

export function getMediaFileInfo(fileName: string): { kind: MediaKind; mimeType: string } | null {
  const extension = fileName.toLowerCase().split(".").pop() ?? "";
  return FILE_TYPES[extension] ?? null;
}

export function getMediaFileMaxBytes(fileName: string, kind: MediaKind): number {
  const extension = fileName.toLowerCase().split(".").pop() ?? "";
  if (kind === "image" && extension === "gif") return 15 * 1024 * 1024;
  if (kind === "image" && extension === "svg") return 250 * 1024;
  if (kind === "image") return 50 * 1024 * 1024;
  if (kind === "video") return 15 * 1024 * 1024 * 1024;
  return 100 * 1024 * 1024;
}
