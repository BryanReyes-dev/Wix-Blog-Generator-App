export const MAX_RESEARCH_LINKS = 5;
export const MAX_MEDIA_FILES = 4;
export const MAX_VISUAL_FRAMES = 8;
export const MAX_SINGLE_FRAME_CHARS = 850_000;
export const MAX_MEDIA_REFERENCE_CHARS = 3_500_000;
export const MAX_DIRECT_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_MEDIA_UPLOAD_BYTES = 15 * 1024 * 1024 * 1024;

export const ACCEPTED_IMAGE_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp",
  "image/heic", "image/heif", "image/tiff", "image/avif", "image/svg+xml",
]);
export const ACCEPTED_VIDEO_TYPES = new Set([
  "video/mp4", "video/webm", "video/quicktime", "video/x-msvideo",
  "video/x-matroska", "video/mpeg", "video/x-ms-wmv",
]);
export const ACCEPTED_AUDIO_TYPES = new Set([
  "audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp4", "audio/aac",
  "audio/flac", "audio/x-ms-wma", "audio/aiff",
]);
