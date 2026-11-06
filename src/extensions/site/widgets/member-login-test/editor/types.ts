export type GeneratedArticle = {
  title: string;
  introduction: string;
  sections: Array<{ heading: string; body: string }>;
  conclusion: string;
  metaDescription: string;
  seoKeywords: string[];
};

export type ResearchSource = {
  id: string;
  title: string;
  url: string;
  publisher: string;
  retrievedAt: string;
  excerpt: string;
  userNotes?: string;
};

export type MemberIdentity = {
  memberId: string;
  displayName: string;
};

export type ReviewData = {
  article: GeneratedArticle;
  sources: ResearchSource[];
  generatedBy: string;
};
