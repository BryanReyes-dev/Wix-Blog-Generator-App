export type MediaFrame = { label: string; dataUrl: string };

export type MediaReference = {
  id: string;
  name: string;
  kind: "image" | "video";
  notes: string;
  frames: MediaFrame[];
  originalBytes: number;
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
