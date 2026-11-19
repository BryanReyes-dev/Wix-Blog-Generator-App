export const MAX_RESEARCH_LINKS = 5;
export const MAX_MEDIA_FILES = 4;
export const MAX_VISUAL_FRAMES = 8;
export const MAX_SINGLE_FRAME_CHARS = 850_000;
export const MAX_MEDIA_REFERENCE_CHARS = 3_500_000;
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

export const ACCEPTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export const ACCEPTED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);
