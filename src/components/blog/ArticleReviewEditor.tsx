import { useEffect, useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { articleToEditableBody, type GeneratedArticle } from "../../lib/blog-content";
import type { MediaPlacement, ResearchSource, UploadedMedia } from "../../lib/media-reference-types";
import { ARTICLE_TEMPLATES, DEFAULT_ARTICLE_DESIGN, getArticleTemplate, type ArticleDesignSettings } from "../../lib/article-layout";
import { ActionButton } from "../ui/ActionButton";
import { FormField } from "../ui/FormField";
import styles from "./BlogWorkflow.module.css";

type ArticleReviewEditorProps = {
  article: GeneratedArticle;
  design?: ArticleDesignSettings;
  onDesignChange?: (design: ArticleDesignSettings) => void;
  sources: ResearchSource[];
  media: UploadedMedia[];
  isSaving: boolean;
  draftSaved: boolean;
  onSave: (draft: { title: string; body: string; mediaPlacements: MediaPlacement[] }) => Promise<void>;
};

function renderCitations(value: string, sources: ResearchSource[]): ReactNode[] {
  const sourceById = new Map(sources.map((source) => [source.id, source] as const));
  const parts: ReactNode[] = [];
  const pattern = /\[S\d+\]/g;
  let cursor = 0;

  for (const match of value.matchAll(pattern)) {
    const token = match[0];
    const index = match.index;
    if (index > cursor) parts.push(value.slice(cursor, index));
    const source = sourceById.get(token.slice(1, -1));
    parts.push(source
      ? <a key={token + "-" + index} className={styles.citationLink} href={source.url} target="_blank" rel="noreferrer" title={source.title}>{token}</a>
      : token);
    cursor = index + token.length;
  }

  if (cursor < value.length) parts.push(value.slice(cursor));
  return parts;
}

function mediaKindLabel(kind: UploadedMedia["kind"]): string {
  if (kind === "image") return "Image";
  if (kind === "video") return "Video";
  if (kind === "audio") return "Audio";
  return "File attachment";
}

function renderEditorialMedia(
  media: UploadedMedia,
  placement: MediaPlacement,
  key: string,
  galleryItem = false,
): ReactNode {
  const layoutClass = galleryItem
    ? styles.editorialMediaGalleryItem
    : placement.layout === "split-left"
      ? styles.editorialMediaSplitLeft
      : placement.layout === "split-right"
        ? styles.editorialMediaSplitRight
        : styles.editorialMediaWide;

  return (
    <figure className={styles.editorialMediaFigure + " " + layoutClass} key={key}>
      {media.kind === "image" ? (
        <img className={styles.editorialMediaVisual} src={media.fileUrl} alt={placement.altText || media.name} loading="lazy" />
      ) : media.kind === "video" ? (
        <video className={styles.editorialMediaVisual} controls preload="metadata" src={media.fileUrl} poster={media.thumbnailUrl} />
      ) : media.kind === "audio" ? (
        <audio controls preload="metadata" src={media.fileUrl} />
      ) : (
        <a className={styles.editorialDownload} href={media.fileUrl} target="_blank" rel="noreferrer">
          <span aria-hidden="true">↗</span>
          <span><strong>{media.name}</strong><small>Download attached file</small></span>
        </a>
      )}
      <div className={styles.editorialMediaAside}>
        {placement.layoutText ? <p className={styles.editorialMediaLayoutText}>{placement.layoutText}</p> : null}
        {placement.caption ? <p className={styles.editorialMediaCaption}>{placement.caption}</p> : null}
      </div>
    </figure>
  );
}

function renderPreviewBody(
  body: string,
  sources: ResearchSource[],
  media: UploadedMedia[],
  placements: MediaPlacement[],
  sectionCount: number,
  skipMediaId?: string,
) {
  const blocks = body.split(/\n{2,}/).map((value) => value.trim()).filter(Boolean);
  const nodes: ReactNode[] = [];
  const mediaById = new Map(media.map((item) => [item.referenceId, item] as const));
  const inserted = new Set<string>();
  let currentSection = -1;
  let nextSection = 0;
  let paragraphCount = 0;

  const insertMedia = (sectionIndex: number, afterParagraph: number) => {
    const matching = placements.filter((placement) =>
      placement.sectionIndex === sectionIndex && placement.afterParagraph === afterParagraph,
    );
    matching.forEach((placement, order) => {
      if (inserted.has(placement.referenceId) || placement.referenceId === skipMediaId) return;
      const asset = mediaById.get(placement.referenceId);
      if (!asset) return;

      if (placement.layout === "gallery" && placement.galleryGroup && asset.kind === "image") {
        const group = matching.filter((candidate) =>
          candidate.layout === "gallery" &&
          candidate.galleryGroup === placement.galleryGroup &&
          !inserted.has(candidate.referenceId) &&
          candidate.referenceId !== skipMediaId &&
          mediaById.get(candidate.referenceId)?.kind === "image",
        );
        if (group.length > 1) {
          nodes.push(
            <div className={styles.editorialMediaGallery} key={"gallery-" + placement.galleryGroup + "-" + order}>
              {group.map((item, itemIndex) => {
                const galleryAsset = mediaById.get(item.referenceId);
                return galleryAsset ? renderEditorialMedia(galleryAsset, item, item.referenceId + "-gallery-" + itemIndex, true) : null;
              })}
            </div>,
          );
          group.forEach((item) => inserted.add(item.referenceId));
          return;
        }
      }

      nodes.push(renderEditorialMedia(asset, placement, placement.referenceId + "-" + order));
      inserted.add(placement.referenceId);
    });
  };

  blocks.forEach((block, index) => {
    const heading = /^(#{1,6})\s+(.+)$/.exec(block);
    if (heading) {
      const label = (heading[2] ?? "").trim();
      const normalized = label.toLowerCase();
      if (normalized === "introduction") currentSection = -1;
      else if (normalized === "conclusion") currentSection = sectionCount;
      else if (normalized === "sources") currentSection = -2;
      else currentSection = nextSection++;
      paragraphCount = 0;
      nodes.push(<h3 className={styles.editorialPreviewHeading} key={"heading-" + index}>{renderCitations(label, sources)}</h3>);
      insertMedia(currentSection, 0);
      return;
    }

    if (block.startsWith("- ")) {
      const items = block.split("\n").map((line) => line.replace(/^[-*]\s+/, "").trim()).filter(Boolean);
      nodes.push(<ul className={styles.previewList} key={"list-" + index}>{items.map((item, itemIndex) => <li key={itemIndex}>{renderCitations(item, sources)}</li>)}</ul>);
    } else {
      nodes.push(<p className={styles.editorialPreviewParagraph} key={"paragraph-" + index}>{renderCitations(block, sources)}</p>);
    }
    paragraphCount += 1;
    insertMedia(currentSection, paragraphCount);
  });

  // If the edited text no longer has its target heading, keep every uploaded file visible.
  media.forEach((asset) => {
    if (inserted.has(asset.referenceId) || asset.referenceId === skipMediaId) return;
    const placement = placements.find((item) => item.referenceId === asset.referenceId);
    if (placement) nodes.push(renderEditorialMedia(asset, placement, asset.referenceId + "-fallback"));
  });

  return nodes;
}

export function ArticleReviewEditor({
  article,
  design = DEFAULT_ARTICLE_DESIGN,
  onDesignChange,
  sources,
  media,
  isSaving,
  draftSaved,
  onSave,
}: ArticleReviewEditorProps) {
  const [title, setTitle] = useState(article.title);
  const [body, setBody] = useState(articleToEditableBody(article));
  const [mediaPlacements, setMediaPlacements] = useState<MediaPlacement[]>(article.mediaPlacements ?? []);
  const [activeDesign, setActiveDesign] = useState<ArticleDesignSettings>(design);

  useEffect(() => {
    setActiveDesign(design);
  }, [design]);

  const updateDesign = (patch: Partial<ArticleDesignSettings>) => {
    const next = { ...activeDesign, ...patch };
    setActiveDesign(next);
    onDesignChange?.(next);
  };

  useEffect(() => {
    setTitle(article.title);
    setBody(articleToEditableBody(article));
    setMediaPlacements(article.mediaPlacements ?? []);
  }, [article]);

  useEffect(() => {
    const validReferences = new Set(media.map((item) => item.referenceId));
    setMediaPlacements((current) => current.filter((placement) => validReferences.has(placement.referenceId)));
  }, [media]);

  const mediaById = useMemo(
    () => new Map(media.map((item) => [item.referenceId, item] as const)),
    [media],
  );
  const availableSections = [
    { value: -1, label: "Introduction" },
    ...article.sections.map((section, index) => ({ value: index, label: section.heading })),
    { value: article.sections.length, label: "Conclusion" },
  ];

  const updatePlacement = (referenceId: string, patch: Partial<MediaPlacement>) => {
    setMediaPlacements((current) => current.map((placement) =>
      placement.referenceId === referenceId ? { ...placement, ...patch } : placement,
    ));
  };

  const groupImagesIntoGallery = () => {
    const imagePlacements = mediaPlacements.filter((placement) => mediaById.get(placement.referenceId)?.kind === "image");
    if (imagePlacements.length < 2) return;
    const anchor = imagePlacements[0]!;
    const imageIds = new Set(imagePlacements.map((placement) => placement.referenceId));
    setMediaPlacements((current) => current.map((placement) => imageIds.has(placement.referenceId)
      ? { ...placement, sectionIndex: anchor.sectionIndex, afterParagraph: anchor.afterParagraph, layout: "gallery", galleryGroup: "editorial-gallery" }
      : placement,
    ));
  };

  const movePlacement = (referenceId: string, direction: -1 | 1) => {
    setMediaPlacements((current) => {
      const index = current.findIndex((placement) => placement.referenceId === referenceId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  const leadImagePlacement = mediaPlacements.find((placement) =>
    placement.sectionIndex === -1 && placement.afterParagraph === 0 &&
    (placement.layout === undefined || placement.layout === "wide") &&
    mediaById.get(placement.referenceId)?.kind === "image",
  );
  const leadImage = leadImagePlacement ? mediaById.get(leadImagePlacement.referenceId) : undefined;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void onSave({ title, body, mediaPlacements });
  };

  return (
    <section className={styles.reviewSection} aria-label="Editorial article review">
      <div className={styles.editorialMasthead}>
        <div>
          <p className={styles.editorialKicker}>THE EDITORIAL DESK <span> / </span> ISSUE NO. 01</p>
          <h3 className={styles.workflowSectionTitle}>Review your story</h3>
          <p className={styles.workflowIntro}>Shape the article, position its media, and review the publication-style preview before creating an unpublished Wix Blog draft.</p>
        </div>
        <span className={styles.editorialStatus}>{draftSaved ? "DRAFT SAVED" : "EDITORIAL REVIEW"}</span>
      </div>

      <div className={styles.editorLayout}>
        <form className={styles.editorialForm} onSubmit={handleSubmit}>
          <div className={styles.editorialFormMasthead}>
            <span>01 / MANUSCRIPT</span>
            <span>{body.length.toLocaleString()} / 30,000</span>
          </div>
          <FormField label="Headline" htmlFor="draft-title" required>
            <input className={styles.editorialHeadlineInput} id="draft-title" name="title" type="text" maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} required />
          </FormField>
          <FormField label="Article copy" htmlFor="draft-body" required hint={'Edit the story text. Keep section headings in the format "## Heading" so the preview can preserve editorial structure.'}>
            <textarea className={styles.editorialBodyInput} id="draft-body" name="body" rows={24} maxLength={30000} value={body} onChange={(event) => setBody(event.target.value)} required />
          </FormField>

          <section className={styles.mediaPlacementPanel} aria-label="Article media placement">
            <div className={styles.mediaPlacementHeader}>
              <div>
                <span className={styles.editorialKicker}>02 / ART DIRECTION</span>
                <h4>Place your media</h4>
                <p>Use wide images, split features, or group related images into a gallery. All uploaded originals remain available to the draft.</p>
                {media.filter((item) => item.kind === "image").length > 1 && getArticleTemplate(activeDesign.templateId).allowedMediaLayouts.includes("gallery") ? (
                  <button type="button" className={styles.secondaryAction} onClick={groupImagesIntoGallery}>Group images into gallery</button>
                ) : null}
              </div>
              <span className={styles.editorialMediaCount}>{media.length} FILE{media.length === 1 ? "" : "S"}</span>
            </div>

            {media.length === 0 ? (
              <p className={styles.emptyState}>No original files were attached to this article.</p>
            ) : (
              <div className={styles.mediaPlacementList}>
                {mediaPlacements.map((placement, index) => {
                  const asset = mediaById.get(placement.referenceId);
                  if (!asset) return null;
                  return (
                    <article className={styles.mediaPlacementCard} key={placement.referenceId}>
                      <div className={styles.mediaPlacementCardHeader}>
                        <div>
                          <strong>{asset.name}</strong>
                          <span>{mediaKindLabel(asset.kind)}</span>
                        </div>
                        <div className={styles.mediaOrderControls}>
                          <button type="button" className={styles.editorialIconButton} disabled={index === 0} aria-label={"Move " + asset.name + " earlier"} onClick={() => movePlacement(placement.referenceId, -1)}>↑</button>
                          <button type="button" className={styles.editorialIconButton} disabled={index === mediaPlacements.length - 1} aria-label={"Move " + asset.name + " later"} onClick={() => movePlacement(placement.referenceId, 1)}>↓</button>
                        </div>
                      </div>
                      <label className={styles.editorialControlLabel}>
                        SECTION
                        <select value={String(placement.sectionIndex)} onChange={(event) => updatePlacement(placement.referenceId, { sectionIndex: Number(event.target.value) })}>
                          {availableSections.map((section) => <option key={section.value} value={section.value}>{section.label}</option>)}
                        </select>
                      </label>
                      {asset.kind === "image" ? (
                        <label className={styles.editorialControlLabel}>
                          IMAGE LAYOUT
                          <select value={placement.layout ?? "wide"} onChange={(event) => {
                            const layout = event.target.value as NonNullable<MediaPlacement["layout"]>;
                            updatePlacement(placement.referenceId, {
                              layout,
                              galleryGroup: layout === "gallery" ? placement.galleryGroup || "editorial-gallery" : "",
                            });
                          }}>
                            {getArticleTemplate(activeDesign.templateId).allowedMediaLayouts.map((layout) => (
                              <option key={layout} value={layout}>
                                {layout === "wide" ? "Full width" : layout === "split-left" ? "Split · image left" : layout === "split-right" ? "Split · image right" : "Gallery"}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                      <label className={styles.editorialControlLabel}>
                        POSITION
                        <select value={String(placement.afterParagraph)} onChange={(event) => updatePlacement(placement.referenceId, { afterParagraph: Number(event.target.value) })}>
                          <option value="0">At section opening</option>
                          <option value="1">After first paragraph</option>
                        </select>
                      </label>
                      {asset.kind === "image" && (placement.layout === "split-left" || placement.layout === "split-right") ? (
                        <label className={styles.editorialControlLabel}>
                          SIDE NOTE / SUPPORTING COPY
                          <textarea rows={3} maxLength={700} value={placement.layoutText ?? ""} onChange={(event) => updatePlacement(placement.referenceId, { layoutText: event.target.value })} />
                        </label>
                      ) : null}
                      <label className={styles.editorialControlLabel}>
                        CAPTION
                        <input maxLength={500} value={placement.caption} onChange={(event) => updatePlacement(placement.referenceId, { caption: event.target.value })} />
                      </label>
                      {asset.kind === "image" ? (
                        <label className={styles.editorialControlLabel}>
                          IMAGE ALT TEXT
                          <input maxLength={500} value={placement.altText} onChange={(event) => updatePlacement(placement.referenceId, { altText: event.target.value })} />
                        </label>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <div className={styles.editorialSaveRow}>
            <p>Your draft stays unpublished. Nothing is sent live when you save.</p>
            <ActionButton type="submit" disabled={isSaving || draftSaved}>
              {isSaving ? "Creating draft…" : draftSaved ? "Unpublished draft saved" : "Create unpublished draft"}
            </ActionButton>
          </div>
        </form>

        <div className={styles.editorialPreviewColumn} aria-label="Publication preview">
          <div className={styles.editorialPreviewToolbar}>
            <div><span className={styles.editorialLiveDot} /> LIVE LAYOUT PREVIEW</div>
            <span>DESIGN SYSTEM</span>
          </div>
          <div className={styles.articleDesignControls}>
            <label>
              <span>Template</span>
              <select value={activeDesign.templateId} onChange={(event) => {
                const templateId = event.target.value as ArticleDesignSettings["templateId"];
                updateDesign({ templateId, accentColor: getArticleTemplate(templateId).accentColor });
                const allowed = getArticleTemplate(templateId).allowedMediaLayouts;
                setMediaPlacements((current) => current.map((placement) =>
                  placement.layout && !allowed.includes(placement.layout) ? { ...placement, layout: "wide", galleryGroup: "" } : placement,
                ));
              }}>
                {ARTICLE_TEMPLATES.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
              </select>
            </label>
            <label>
              <span>Accent</span>
              <input className={styles.articleAccentInput} type="color" value={activeDesign.accentColor} onChange={(event) => updateDesign({ accentColor: event.target.value.toUpperCase() })} />
            </label>
            <label>
              <span>Density</span>
              <select value={activeDesign.density} onChange={(event) => updateDesign({ density: event.target.value as ArticleDesignSettings["density"] })}>
                <option value="balanced">Balanced</option><option value="visual-rich">Image-forward</option><option value="quiet">Quiet</option>
              </select>
            </label>
          </div>
          <article className={styles.editorialPublication} data-template={activeDesign.templateId} data-density={activeDesign.density} style={{ "--article-accent": activeDesign.accentColor } as CSSProperties}>
            <header className={styles.editorialPublicationHeader}>
              <span>THE DAILY EDITION</span>
              <span>ARTICLES <i>✳</i> IDEAS <i>✳</i> CULTURE</span>
            </header>
            <div className={styles.editorialPublicationRule} />
            <div className={styles.editorialArticleEyebrow}>
              <span>{article.seoKeywords[0]?.toUpperCase() ?? "FEATURE"}</span>
              <span>FEATURED STORY</span>
            </div>
            <h2 className={styles.editorialPreviewTitle}>{title || "Your story headline"}</h2>
            <p className={styles.editorialDeck}>{article.metaDescription}</p>
            <div className={styles.editorialByline}>
              <span className={styles.editorialAvatar}>ED</span>
              <span><strong>Editorial team</strong><small>AI-assisted draft · Human review</small></span>
              <span className={styles.editorialReadTime}>EDITOR'S COPY</span>
            </div>
            <div className={styles.editorialHeroPlaceholder}>
              {leadImage
                ? <img src={leadImage.fileUrl} alt={leadImagePlacement?.altText || leadImage.name} />
                : <div><span>THE STORY</span><strong>Words with a point of view.</strong></div>}
            </div>
            <div className={styles.editorialHeroCaption}>A story composed for the reader — with original media from your upload.</div>
            <div className={styles.editorialArticleBody}>
              {renderPreviewBody(body, sources, media, mediaPlacements, article.sections.length, leadImage?.referenceId)}
            </div>
            <footer className={styles.editorialPublicationFooter}>
              <span>THE DAILY EDITION</span>
              <span>END OF ARTICLE</span>
            </footer>
          </article>

          {sources.length > 0 ? (
            <aside className={styles.editorialSources}>
              <span className={styles.editorialKicker}>RESEARCH NOTES</span>
              <h4>Sources & references</h4>
              <ol>
                {sources.map((source) => (
                  <li key={source.id}>
                    <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a>
                    <span>{source.publisher}</span>
                  </li>
                ))}
              </ol>
            </aside>
          ) : null}
          <aside className={styles.editorialMetadata}>
            <span className={styles.editorialKicker}>SEARCH / DISCOVERY</span>
            <h4>Search metadata</h4>
            <p>{article.metaDescription}</p>
            <div>{article.seoKeywords.map((keyword) => <span key={keyword}>{keyword}</span>)}</div>
          </aside>
        </div>
      </div>
    </section>
  );
}
