import type { MediaKind } from "../media-reference-types";

export class MediaReferenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaReferenceError";
  }
}

export const MAX_MEDIA_REFERENCES = 4;
export const MAX_MEDIA_FRAMES = 8;
export const MAX_MEDIA_REFERENCE_CHARS = 4_000_000;
const MAX_FRAME_DATA_URL_CHARS = 900_000;
const MAX_MEDIA_NAME_LENGTH = 160;
const MAX_MEDIA_NOTES_LENGTH = 500;

export type MediaReferenceFrame = {
  label: string;
  dataUrl: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
};

export type MediaReference = {
  id: string;
  name: string;
  kind: MediaKind;
  notes: string;
  frames: MediaReferenceFrame[];
};

export type DraftMediaInput = {
  referenceId: string;
  fileId: string;
  name: string;
  kind: MediaKind;
  mimeType: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
};

const MEDIA_KINDS = new Set<MediaKind>(["image", "video", "audio", "document"]);

export function parseMediaReferences(value: unknown): MediaReference[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > MAX_MEDIA_REFERENCES) {
    throw new MediaReferenceError(`Attach no more than ${MAX_MEDIA_REFERENCES} article media files.`);
  }

  let totalFrames = 0;
  let totalCharacters = 0;

  return value.map((entry, index): MediaReference => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new MediaReferenceError(`Article media item ${index + 1} is invalid.`);
    }
    const input = entry as Record<string, unknown>;
    const id = typeof input.id === "string" ? input.id.trim() : "";
    const name = typeof input.name === "string" ? input.name.trim() : "";
    const kind = input.kind;
    const notes = input.notes === undefined ? "" : input.notes;
    const frames = input.frames;

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      throw new MediaReferenceError(`Article media item ${index + 1} has an invalid reference ID.`);
    }
    if (!name || name.length > MAX_MEDIA_NAME_LENGTH || /[\u0000-\u001f]/.test(name)) {
      throw new MediaReferenceError(`Article media item ${index + 1} has an invalid file name.`);
    }
    if (typeof kind !== "string" || !MEDIA_KINDS.has(kind as MediaKind)) {
      throw new MediaReferenceError(`Article media item ${index + 1} has an unsupported media type.`);
    }
    if (typeof notes !== "string" || notes.length > MAX_MEDIA_NOTES_LENGTH) {
      throw new MediaReferenceError(`Notes for ${name} must be 500 characters or fewer.`);
    }
    if (!Array.isArray(frames) || frames.length > 3) {
      throw new MediaReferenceError(`${name} may contain up to three AI preview frames.`);
    }
    if (kind !== "image" && kind !== "video" && frames.length > 0) {
      throw new MediaReferenceError(`${name} does not support visual analysis frames.`);
    }
    if (kind === "image" && frames.length > 1) {
      throw new MediaReferenceError(`${name} must contain no more than one image preview frame.`);
    }

    totalFrames += frames.length;
    if (totalFrames > MAX_MEDIA_FRAMES) {
      throw new MediaReferenceError(`Article media may contain no more than ${MAX_MEDIA_FRAMES} AI preview frames in total.`);
    }

    const validFrames = frames.map((frame): MediaReferenceFrame => {
      if (!frame || typeof frame !== "object" || Array.isArray(frame)) {
        throw new MediaReferenceError(`A visual frame in ${name} is invalid.`);
      }
      const frameInput = frame as Record<string, unknown>;
      const label = typeof frameInput.label === "string" ? frameInput.label.trim() : "";
      const dataUrl = typeof frameInput.dataUrl === "string" ? frameInput.dataUrl : "";
      const width = frameInput.width;
      const height = frameInput.height;
      const durationSeconds = frameInput.durationSeconds;
      if (!label || label.length > 80) {
        throw new MediaReferenceError(`A visual frame label in ${name} is invalid.`);
      }
      if (dataUrl.length > MAX_FRAME_DATA_URL_CHARS) {
        throw new MediaReferenceError(`A visual frame in ${name} is too large. Use a smaller original file.`);
      }
      const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
      if (!match || (match[1]?.length ?? 0) % 4 !== 0) {
        throw new MediaReferenceError(`A visual frame in ${name} must be a valid JPEG data URL.`);
      }
      if (width !== undefined && (typeof width !== "number" || !Number.isInteger(width) || width < 1 || width > 20000)) {
        throw new MediaReferenceError(`A visual frame in ${name} has invalid dimensions.`);
      }
      if (height !== undefined && (typeof height !== "number" || !Number.isInteger(height) || height < 1 || height > 20000)) {
        throw new MediaReferenceError(`A visual frame in ${name} has invalid dimensions.`);
      }
      totalCharacters += dataUrl.length;
      if (totalCharacters > MAX_MEDIA_REFERENCE_CHARS) {
        throw new MediaReferenceError("AI preview frames are too large to process together. Remove a frame or use smaller images.");
      }
      if (durationSeconds !== undefined && (typeof durationSeconds !== "number" || !Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > 60 * 60 * 24)) {
        throw new MediaReferenceError(`A visual frame in ${name} has an invalid video duration.`);
      }
      return {
        label,
        dataUrl,
        ...(typeof width === "number" ? { width } : {}),
        ...(typeof height === "number" ? { height } : {}),
        ...(typeof durationSeconds === "number" ? { durationSeconds } : {}),
      };
    });

    return { id, name, kind: kind as MediaKind, notes: notes.trim(), frames: validFrames };
  });
}

export function parseDraftMediaInputs(value: unknown): DraftMediaInput[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > MAX_MEDIA_REFERENCES) {
    throw new MediaReferenceError(`A draft may contain up to ${MAX_MEDIA_REFERENCES} uploaded media files.`);
  }

  const seen = new Set<string>();
  return value.map((entry, index): DraftMediaInput => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new MediaReferenceError(`Uploaded media item ${index + 1} is invalid.`);
    }
    const input = entry as Record<string, unknown>;
    const referenceId = typeof input.referenceId === "string" ? input.referenceId.trim() : "";
    const fileId = typeof input.fileId === "string" ? input.fileId.trim() : "";
    const name = typeof input.name === "string" ? input.name.trim() : "";
    const kind = input.kind;
    const mimeType = typeof input.mimeType === "string" ? input.mimeType.trim() : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(referenceId) ||
        !/^[A-Za-z0-9._~-]{8,200}$/.test(fileId) ||
        !name || name.length > 255 ||
        typeof kind !== "string" || !MEDIA_KINDS.has(kind as MediaKind) ||
        !/^[\w.+-]+\/[\w.+-]+$/.test(mimeType)) {
      throw new MediaReferenceError(`Uploaded media item ${index + 1} has invalid metadata.`);
    }
    if (seen.has(referenceId)) throw new MediaReferenceError("An uploaded media reference was included more than once.");
    seen.add(referenceId);
    const width = input.width;
    const height = input.height;
    if (width !== undefined && (typeof width !== "number" || !Number.isInteger(width) || width < 1 || width > 20000)) {
      throw new MediaReferenceError(`Dimensions for ${name} are invalid.`);
    }
    if (height !== undefined && (typeof height !== "number" || !Number.isInteger(height) || height < 1 || height > 20000)) {
      throw new MediaReferenceError(`Dimensions for ${name} are invalid.`);
    }
    const durationSeconds = input.durationSeconds;
    if (durationSeconds !== undefined && (typeof durationSeconds !== "number" || !Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > 60 * 60 * 24)) {
      throw new MediaReferenceError(`Duration for ${name} is invalid.`);
    }
    return {
      referenceId,
      fileId,
      name,
      kind: kind as MediaKind,
      mimeType,
      ...(typeof width === "number" ? { width } : {}),
      ...(typeof height === "number" ? { height } : {}),
      ...(typeof durationSeconds === "number" && Number.isFinite(durationSeconds) && durationSeconds > 0 ? { durationSeconds } : {}),
    };
  });
}
