export type MediaKind = "image" | "video" | "audio" | "document";

export type MediaFrame = {
  label: string;
  dataUrl: string;
  width: number;
  height: number;
  durationSeconds?: number;
};

export type MediaReference = {
  id: string;
  name: string;
  kind: MediaKind;
  notes: string;
  frames: MediaFrame[];
  originalBytes: number;
  file: File;
};

export type MediaReferenceInput = Omit<MediaReference, "file" | "originalBytes">;

export type MediaPlacement = {
  referenceId: string;
  /** -1 = introduction, 0..n-1 = article sections, n = conclusion. */
  sectionIndex: number;
  /** 0 = directly below the section heading; 1 = after its first paragraph, etc. */
  afterParagraph: number;
  caption: string;
  altText: string;
  layout?: import("./article-layout").ArticleMediaLayout;
  galleryGroup?: string;
  layoutText?: string;
};

export type UploadedMedia = {
  referenceId: string;
  fileId: string;
  name: string;
  kind: MediaKind;
  mimeType: string;
  fileUrl: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  thumbnailUrl?: string;
  videoMediaId?: string;
  videoThumbnailId?: string;
};

export type ResearchLinkInput = { id: string; url: string; notes: string };

export type ResearchSource = {
  id: string;
  title: string;
  url: string;
  publisher: string;
  retrievedAt: string;
  excerpt: string;
  userNotes?: string;
};
