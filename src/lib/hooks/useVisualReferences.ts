import { useState } from 'react';
import {
  MAX_IMAGE_BYTES,
  MAX_MEDIA_FILES,
  MAX_MEDIA_REFERENCE_CHARS,
  MAX_VIDEO_BYTES,
  MAX_VISUAL_FRAMES,
} from '../media-reference-constants';
import { getMediaKind, imageReference, videoReferenceFrames } from '../media-reference';
import type { MediaReference } from '../media-reference-types';

type ReportStatus = (message: string, tone?: 'info' | 'error' | 'success') => void;

export function useVisualReferences(reportStatus: ReportStatus) {
  const [mediaReferences, setMediaReferences] = useState<MediaReference[]>([]);
  const [isPreparingMedia, setIsPreparingMedia] = useState(false);

  const addFiles = async (files: File[]) => {
    if (files.length === 0) return;

    const nextReferences = [...mediaReferences];
    setIsPreparingMedia(true);

    try {
      for (const file of files) {
        if (nextReferences.length >= MAX_MEDIA_FILES) {
          reportStatus('Attach up to ' + MAX_MEDIA_FILES + ' reference files. Remove a file before adding another.', 'error');
          break;
        }

        const kind = getMediaKind(file);
        if (!kind) {
          reportStatus('Unsupported file type for ' + file.name + '. Use JPG, PNG, WebP, GIF, MP4, MOV, or WebM.', 'error');
          continue;
        }

        const sizeLimit = kind === 'image' ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
        if (file.size <= 0 || file.size > sizeLimit) {
          reportStatus(file.name + ' is too large. Images must be 20 MB or less; videos must be 100 MB or less.', 'error');
          continue;
        }

        const existingFrameCount = nextReferences.reduce(
          (total, reference) => total + reference.frames.length,
          0,
        );
        const remainingFrames = MAX_VISUAL_FRAMES - existingFrameCount;
        if (remainingFrames <= 0) {
          reportStatus('You can attach up to ' + MAX_VISUAL_FRAMES + ' visual frames. Remove a reference to make room.', 'error');
          break;
        }

        try {
          reportStatus('Preparing ' + file.name + ' for visual analysis…');
          const frames = kind === 'image'
            ? [await imageReference(file)]
            : await videoReferenceFrames(file, remainingFrames);
          const currentEncodedChars = nextReferences.reduce((total, reference) =>
            total + reference.frames.reduce((frameTotal, frame) => frameTotal + frame.dataUrl.length, 0),
          0);
          const incomingEncodedChars = frames.reduce((total, frame) => total + frame.dataUrl.length, 0);

          if (currentEncodedChars + incomingEncodedChars > MAX_MEDIA_REFERENCE_CHARS) {
            reportStatus('Reference images are too large together. Remove a file or use smaller files.', 'error');
            continue;
          }

          nextReferences.push({
            id: crypto.randomUUID(),
            name: file.name.slice(0, 160),
            kind,
            notes: '',
            frames,
            originalBytes: file.size,
          });
          setMediaReferences([...nextReferences]);
          reportStatus('Attached ' + file.name + ' as a visual reference.', 'success');
        } catch (error) {
          reportStatus(error instanceof Error ? error.message : 'Could not read ' + file.name + '.', 'error');
        }
      }
    } finally {
      setIsPreparingMedia(false);
    }
  };

  const updateNote = (id: string, notes: string) => {
    setMediaReferences((current) => current.map((reference) =>
      reference.id === id ? { ...reference, notes } : reference,
    ));
  };

  const removeReference = (id: string) => {
    setMediaReferences((current) => current.filter((reference) => reference.id !== id));
  };

  return { mediaReferences, isPreparingMedia, addFiles, updateNote, removeReference };
}
