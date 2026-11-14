import { useState } from "react";
import {
  MAX_MEDIA_FILES,
  MAX_MEDIA_REFERENCE_CHARS,
  MAX_VISUAL_FRAMES,
} from "../media-reference-constants";
import { getMediaFileMaxBytes } from "../media-file-types";
import { getMediaKind, imageReference, videoReferenceFrames } from "../media-reference";
import type { MediaReference } from "../media-reference-types";

type ReportStatus = (message: string, tone?: "info" | "error" | "success") => void;

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
          reportStatus("Attach up to " + MAX_MEDIA_FILES + " article media files. Remove a file before adding another.", "error");
          break;
        }

        const kind = getMediaKind(file);
        if (!kind) {
          reportStatus("Unsupported file type for " + file.name + ". Choose a Wix-supported image, video, audio, PDF, document, or archive file.", "error");
          continue;
        }

        const sizeLimit = getMediaFileMaxBytes(file.name, kind);
        if (file.size <= 0 || file.size > sizeLimit) {
          reportStatus(file.name + " exceeds the file-size limit for this media type.", "error");
          continue;
        }

        const existingFrameCount = nextReferences.reduce(
          (total, reference) => total + reference.frames.length,
          0,
        );
        const remainingFrames = Math.max(0, MAX_VISUAL_FRAMES - existingFrameCount);
        let frames: MediaReference["frames"] = [];

        if ((kind === "image" || kind === "video") && remainingFrames > 0) {
          try {
            reportStatus("Preparing " + file.name + " for AI visual analysis…");
            frames = kind === "image"
              ? [await imageReference(file)]
              : await videoReferenceFrames(file, remainingFrames);
          } catch {
            reportStatus(file.name + " will still be uploaded and added to the article, but this browser could not prepare it for AI visual analysis.", "info");
          }
        }

        const currentEncodedChars = nextReferences.reduce((total, reference) =>
          total + reference.frames.reduce((frameTotal, frame) => frameTotal + frame.dataUrl.length, 0), 0);
        const incomingEncodedChars = frames.reduce((total, frame) => total + frame.dataUrl.length, 0);

        if (currentEncodedChars + incomingEncodedChars > MAX_MEDIA_REFERENCE_CHARS) {
          reportStatus("AI preview images are too large together. This file can still be uploaded, but its frames will not be sent for analysis.", "info");
          frames = [];
        }

        nextReferences.push({
          id: crypto.randomUUID(),
          name: file.name.slice(0, 160),
          kind,
          notes: "",
          frames,
          originalBytes: file.size,
          file,
        });
        setMediaReferences([...nextReferences]);
        reportStatus("Added " + file.name + ". The original file will be uploaded to Wix when you generate the article.", "success");
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
