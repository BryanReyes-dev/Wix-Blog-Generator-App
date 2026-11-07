export type GeneratedArticle = {
  title: string;
  introduction: string;
  sections: Array<{ heading: string; body: string }>;
  conclusion: string;
  metaDescription: string;
  seoKeywords: string[];
};

export type ResearchLink = { id: string; url: string; notes: string };

export type ResearchSource = {
  id: string;
  title: string;
  url: string;
  publisher: string;
  retrievedAt: string;
  excerpt: string;
  userNotes?: string;
};

export type MediaFrame = { label: string; dataUrl: string };

export type MediaReference = {
  id: string;
  name: string;
  kind: "image" | "video";
  notes: string;
  frames: MediaFrame[];
  originalBytes: number;
};

export type MemberIdentity = { memberId: string; displayName: string };
export type Theme = "dark" | "light";

export type Preferences = {
  theme: Theme;
  topic: string;
  audience: string;
  tone: string;
  instructions: string;
  keywords: string;
  researchLinks: Array<{ url: string; notes: string }>;
};

export type ApiError = { error?: string };
export type ApiSuccess<T> = T & { error?: never };
export type StatusKind = "info" | "error" | "success";
export type WorkflowStatus = { message: string; kind: StatusKind };

export type ReviewData = {
  article: GeneratedArticle;
  sources: ResearchSource[];
  generatedBy: string;
};
