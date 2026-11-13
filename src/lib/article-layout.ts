export const ARTICLE_MEDIA_LAYOUTS = ["wide", "split-left", "split-right", "gallery"] as const;
export type ArticleMediaLayout = typeof ARTICLE_MEDIA_LAYOUTS[number];
export type ArticleTemplateId = "editorial" | "minimal" | "visual";
export type ArticleContentDensity = "balanced" | "visual-rich" | "quiet";
export type ArticleDesignSettings = { templateId: ArticleTemplateId; accentColor: string; density: ArticleContentDensity };

export const ARTICLE_TEMPLATES: Array<{
  id: ArticleTemplateId;
  name: string;
  description: string;
  accentColor: string;
  allowedMediaLayouts: ArticleMediaLayout[];
}> = [
  { id: "editorial", name: "Editorial magazine", description: "Warm typography, spacious sections, and flexible image compositions.", accentColor: "#8A6E4B", allowedMediaLayouts: ["wide", "split-left", "split-right", "gallery"] },
  { id: "minimal", name: "Minimal journal", description: "Quiet styling, restrained visual emphasis, and clear reading rhythm.", accentColor: "#465366", allowedMediaLayouts: ["wide", "split-left", "split-right"] },
  { id: "visual", name: "Visual magazine", description: "Image-forward storytelling, paired imagery, and bold section breaks.", accentColor: "#B84B32", allowedMediaLayouts: ["wide", "split-left", "split-right", "gallery"] },
];

export const DEFAULT_ARTICLE_DESIGN: ArticleDesignSettings = { templateId: "editorial", accentColor: "#8A6E4B", density: "balanced" };

export function getArticleTemplate(templateId: ArticleTemplateId) {
  return ARTICLE_TEMPLATES.find((template) => template.id === templateId) ?? ARTICLE_TEMPLATES[0]!;
}

export function parseArticleDesign(value: unknown): ArticleDesignSettings {
  if (value === undefined || value === null) return { ...DEFAULT_ARTICLE_DESIGN };
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("The article design settings are invalid.");
  const input = value as Record<string, unknown>;
  const templateId = input.templateId;
  const density = input.density;
  const accentColor = typeof input.accentColor === "string" ? input.accentColor.trim() : "";
  if (templateId !== "editorial" && templateId !== "minimal" && templateId !== "visual") throw new Error("Choose a supported article design template.");
  if (density !== "balanced" && density !== "visual-rich" && density !== "quiet") throw new Error("Choose a supported article content density.");
  if (!/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(accentColor)) throw new Error("The article accent color must be a valid hex color.");
  return { templateId, density, accentColor: accentColor.toUpperCase() };
}
