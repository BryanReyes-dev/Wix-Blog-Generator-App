import { InputValidationError } from './blog-content';

export const MAX_MEDIA_REFERENCES = 4;
export const MAX_MEDIA_FRAMES = 8;
export const MAX_MEDIA_REFERENCE_CHARS = 4_000_000;
const MAX_FRAME_DATA_URL_CHARS = 900_000;
const MAX_MEDIA_NAME_LENGTH = 160;
const MAX_MEDIA_NOTES_LENGTH = 500;

export type MediaReferenceFrame = {
  label: string;
  dataUrl: string;
};

export type MediaReference = {
  name: string;
  kind: 'image' | 'video';
  notes: string;
  frames: MediaReferenceFrame[];
};

/**
 * Browser uploads are normalized to JPEG reference frames before being sent.
 * Video files are represented by a few sampled frames; audio is not analyzed.
 * Raw file bytes and arbitrary MIME types are never accepted by this endpoint.
 */
export function parseMediaReferences(value: unknown): MediaReference[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > MAX_MEDIA_REFERENCES) {
    throw new InputValidationError(`Attach no more than ${MAX_MEDIA_REFERENCES} reference files.`);
  }

  let totalFrames = 0;
  let totalCharacters = 0;

  const references = value.map((entry, index): MediaReference => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new InputValidationError(`Reference file ${index + 1} is invalid.`);
    }
    const input = entry as Record<string, unknown>;
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    const kind = input.kind;
    const notes = input.notes === undefined ? '' : input.notes;
    const frames = input.frames;

    if (!name || name.length > MAX_MEDIA_NAME_LENGTH || /[\u0000-\u001f]/.test(name)) {
      throw new InputValidationError(`Reference file ${index + 1} has an invalid file name.`);
    }
    if (kind !== 'image' && kind !== 'video') {
      throw new InputValidationError(`Reference file ${index + 1} has an unsupported media type.`);
    }
    if (typeof notes !== 'string' || notes.length > MAX_MEDIA_NOTES_LENGTH) {
      throw new InputValidationError(`Notes for ${name} must be 500 characters or fewer.`);
    }
    if (!Array.isArray(frames) || frames.length < 1 || frames.length > 3) {
      throw new InputValidationError(`${name} must contain between one and three reference frames.`);
    }
    if (kind === 'image' && frames.length !== 1) {
      throw new InputValidationError(`${name} must contain one image reference.`);
    }

    totalFrames += frames.length;
    if (totalFrames > MAX_MEDIA_FRAMES) {
      throw new InputValidationError(`Reference files may contain no more than ${MAX_MEDIA_FRAMES} visual frames in total.`);
    }

    const validFrames = frames.map((frame): MediaReferenceFrame => {
      if (!frame || typeof frame !== 'object' || Array.isArray(frame)) {
        throw new InputValidationError(`A visual frame in ${name} is invalid.`);
      }
      const frameInput = frame as Record<string, unknown>;
      const label = typeof frameInput.label === 'string' ? frameInput.label.trim() : '';
      const dataUrl = typeof frameInput.dataUrl === 'string' ? frameInput.dataUrl : '';
      if (!label || label.length > 80) {
        throw new InputValidationError(`A visual frame label in ${name} is invalid.`);
      }
      if (dataUrl.length > MAX_FRAME_DATA_URL_CHARS) {
        throw new InputValidationError(`A visual frame in ${name} is too large. Use a smaller image or video.`);
      }
      const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
      if (!match || (match[1]?.length ?? 0) % 4 !== 0) {
        throw new InputValidationError(`A visual frame in ${name} must be a valid JPEG data URL.`);
      }
      totalCharacters += dataUrl.length;
      if (totalCharacters > MAX_MEDIA_REFERENCE_CHARS) {
        throw new InputValidationError('Reference images are too large to process together. Remove a file or choose smaller files.');
      }
      return { label, dataUrl };
    });

    return { name, kind, notes: notes.trim(), frames: validFrames };
  });

  return references;
}
