import { httpClient } from '@wix/essentials';
import styles from './member-login-test.module.css';

type GeneratedArticle = {
  title: string;
  introduction: string;
  sections: Array<{ heading: string; body: string }>;
  conclusion: string;
  metaDescription: string;
  seoKeywords: string[];
};

type ResearchSource = {
  id: string;
  title: string;
  url: string;
  publisher: string;
  retrievedAt: string;
  excerpt: string;
};

type ApiError = { error?: string };
type ApiSuccess<T> = T & { error?: never };

const API_BASE_URL = new URL(import.meta.url).origin;

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function addField(
  parent: HTMLElement,
  labelText: string,
  field: HTMLInputElement | HTMLTextAreaElement,
  required: boolean,
  hint?: string,
) {
  const wrapper = element('div', styles.workflowField);
  const label = element('label', styles.workflowLabel);
  label.htmlFor = field.id;
  label.textContent = labelText;
  if (required) label.append(' *');
  wrapper.append(label, field);

  if (hint) {
    const hintText = element('small', styles.workflowHint);
    hintText.textContent = hint;
    wrapper.appendChild(hintText);
  }

  parent.appendChild(wrapper);
}

function makeInput(id: string, placeholder: string, maxLength: number): HTMLInputElement {
  const input = element('input', styles.workflowInput);
  input.id = id;
  input.name = id;
  input.type = 'text';
  input.maxLength = maxLength;
  input.placeholder = placeholder;
  return input;
}

function makeTextArea(id: string, placeholder: string, rows: number, maxLength: number): HTMLTextAreaElement {
  const textarea = element('textarea', styles.workflowTextarea);
  textarea.id = id;
  textarea.name = id;
  textarea.rows = rows;
  textarea.maxLength = maxLength;
  textarea.placeholder = placeholder;
  return textarea;
}

function articleBody(article: GeneratedArticle, sources: ResearchSource[] = []): string {
  const body = [
    '## Introduction',
    article.introduction,
    ...article.sections.flatMap((section) => [`## ${section.heading}`, section.body]),
    '## Conclusion',
    article.conclusion,
  ];
  const articleText = body.join('\n');
  const citedIds = new Set([...articleText.matchAll(/\[(S\d+)\]/g)].map((match) => match[1]));
  const citedSources = sources.filter((source) => citedIds.has(source.id));

  if (citedSources.length > 0) {
    body.push(
      '## Sources',
      ...citedSources.map((source) => `- [${source.id}] ${source.title} — ${source.url}`),
    );
  }

  return body.join('\n\n');
}

function appendSafePreviewText(
  parent: HTMLElement,
  value: string,
  sources: ResearchSource[],
) {
  const tokens = value.split(/(\[S\d+\]|https?:\/\/[^\s<>"']+)/g).filter(Boolean);

  for (const token of tokens) {
    const citation = /^\[(S\d+)\]$/.exec(token);
    if (citation) {
      const source = sources.find((entry) => entry.id === citation[1]);
      if (source) {
        const superscript = element('sup');
        const link = element('a');
        link.href = source.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = token;
        link.setAttribute('aria-label', `Open research source ${source.id} in a new tab`);
        superscript.appendChild(link);
        parent.appendChild(superscript);
      } else {
        parent.appendChild(document.createTextNode(token));
      }
      continue;
    }

    if (token.startsWith('http://') || token.startsWith('https://')) {
      const trailing = /[),.;!?]+$/.exec(token)?.[0] ?? '';
      const target = trailing ? token.slice(0, -trailing.length) : token;
      try {
        const url = new URL(target);
        if (url.protocol === 'http:' || url.protocol === 'https:') {
          const link = element('a');
          link.href = url.href;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.textContent = target;
          parent.appendChild(link);
          if (trailing) parent.appendChild(document.createTextNode(trailing));
          continue;
        }
      } catch {
        // Treat malformed URLs as ordinary text in the preview.
      }
    }

    parent.appendChild(document.createTextNode(token));
  }
}

function renderPreviewContent(
  parent: HTMLElement,
  body: string,
  sources: ResearchSource[],
) {
  parent.replaceChildren();
  const lines = body.replace(/\r\n?/g, '\n').split('\n');
  let paragraphLines: string[] = [];
  let list: HTMLUListElement | null = null;

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    const paragraph = element('p');
    appendSafePreviewText(paragraph, paragraphLines.join(' '), sources);
    parent.appendChild(paragraph);
    paragraphLines = [];
  };

  const stopList = () => {
    list = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      stopList();
      continue;
    }

    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      flushParagraph();
      stopList();
      const heading = element('h' + Math.min(4, Math.max(2, headingMatch[1]?.length ?? 2)));
      appendSafePreviewText(heading, headingMatch[2] ?? '', sources);
      parent.appendChild(heading);
      continue;
    }

    const listMatch = /^[-*]\s+(.+)$/.exec(trimmed);
    if (listMatch) {
      flushParagraph();
      if (!list) {
        list = element('ul');
        parent.appendChild(list);
      }
      const item = element('li');
      appendSafePreviewText(item, listMatch[1] ?? '', sources);
      list.appendChild(item);
      continue;
    }

    stopList();
    paragraphLines.push(trimmed);
  }

  flushParagraph();
}

function renderResearchSources(parent: HTMLElement, sources: ResearchSource[]) {
  if (sources.length === 0) return;

  const card = element('div', styles.metadataCard);
  const heading = element('strong');
  heading.textContent = 'Research links retrieved';
  card.appendChild(heading);

  const list = element('ul', styles.researchSourceList);
  for (const source of sources) {
    const item = element('li');
    const link = element('a');
    link.href = source.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = `[${source.id}] ${source.title}`;
    item.appendChild(link);

    const metadata = element('small');
    metadata.textContent = `${source.publisher} · Retrieved ${new Date(source.retrievedAt).toLocaleString()}`;
    item.appendChild(metadata);

    if (source.excerpt) {
      const excerpt = element('p');
      excerpt.textContent = source.excerpt;
      item.appendChild(excerpt);
    }
    list.appendChild(item);
  }
  card.appendChild(list);
  parent.appendChild(card);
}

async function postJson<T>(path: string, payload: unknown): Promise<T> {
  const response = await httpClient.fetchWithAuth(API_BASE_URL + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = 'The request failed. Check your permissions and site setup.';
    try {
      const result = await response.json() as ApiError;
      if (typeof result.error === 'string') message = result.error;
    } catch {
      // Keep the safe fallback for non-JSON error responses.
    }
    throw new Error(message);
  }

  return await response.json() as T;
}

function renderKeywords(parent: HTMLElement, keywords: string[]) {
  const list = element('ul', styles.keywordList);
  for (const keyword of keywords) {
    const item = element('li');
    item.textContent = keyword;
    list.appendChild(item);
  }
  parent.appendChild(list);
}

export function mountBlogWorkflow(container: HTMLElement, signOut: () => Promise<void>) {
  container.innerHTML = '';

  const root = element('div', `${styles.root} ${styles.workflowRoot}`);
  const topBar = element('div', styles.workflowTopBar);
  const intro = element('div');
  const title = element('h2', styles.title);
  title.textContent = 'Create a Wix Blog draft';
  const copy = element('p', styles.workflowIntro);
  copy.textContent = 'Describe the article, review and edit the generated content, then choose when to save it as an unpublished draft.';
  intro.append(title, copy);

  const signOutButton = element('button', styles.secondaryButton);
  signOutButton.type = 'button';
  signOutButton.textContent = 'Sign out';
  signOutButton.addEventListener('click', async () => {
    signOutButton.disabled = true;
    try {
      await signOut();
    } catch {
      status.textContent = 'Sign-out could not be completed. Please try again.';
      signOutButton.disabled = false;
    }
  });
  topBar.append(intro, signOutButton);

  const status = element('p', styles.status);
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  const briefForm = element('form', styles.workflowForm);
  const topic = makeInput('blog-topic', 'Topic or working title', 200);
  topic.required = true;
  addField(briefForm, 'Topic or working title', topic, true);

  const audience = makeInput('blog-audience', 'Who should this article help?', 300);
  audience.required = true;
  addField(briefForm, 'Target audience', audience, true);

  const tone = makeInput('blog-tone', 'For example: warm, practical, and confident', 120);
  tone.required = true;
  addField(briefForm, 'Writing tone', tone, true);

  const instructions = makeTextArea('blog-instructions', 'Include the points, examples, or instructions the article should cover.', 5, 3_000);
  instructions.required = true;
  addField(briefForm, 'Main points or instructions', instructions, true);

  const keywords = makeInput('blog-keywords', 'Separate keywords with commas', 400);
  addField(briefForm, 'Optional SEO keywords', keywords, false, 'Up to five suggested keywords.');

  const researchUrls = makeTextArea(
    'blog-research-urls',
    'https://example.com/research-article',
    4,
    10_240,
  );
  addField(
    briefForm,
    'Research links (optional)',
    researchUrls,
    false,
    'Paste up to five public webpage URLs, one per line. The app will retrieve readable page text and cite the sources it actually uses. Automatic web search and image uploads are not enabled yet.',
  );

  const generateButton = element('button', styles.button);
  generateButton.type = 'submit';
  generateButton.textContent = 'Generate article';
  briefForm.appendChild(generateButton);

  const review = element('section', styles.reviewSection);
  review.setAttribute('aria-label', 'Review generated article');

  root.append(topBar, status, briefForm, review);
  container.appendChild(root);

  const setStatus = (message: string, kind: 'info' | 'error' | 'success' = 'info') => {
    status.textContent = message;
    status.className = styles.status;
    if (kind === 'error') status.classList.add(styles.errorNotice);
    if (kind === 'success') status.classList.add(styles.successNotice);
  };

  let currentSubmissionId: string | null = null;

  const renderReview = (article: GeneratedArticle, sources: ResearchSource[]) => {
    review.replaceChildren();
    currentSubmissionId = null;

    const heading = element('h3', styles.workflowSectionTitle);
    heading.textContent = 'Review and edit';
    const note = element('p', styles.workflowIntro);
    note.textContent = 'Nothing is saved to Wix Blog until you choose “Create unpublished draft.”';
    const editorPreviewGrid = element('div', styles.editorPreviewGrid);
    const editorPane = element('div', styles.editorPane);
    const editorHeading = element('h4', styles.workflowSectionTitle);
    editorHeading.textContent = 'Editor';
    const reviewForm = element('form', styles.workflowForm);

    const titleInput = makeInput('draft-title', 'Article title', 200);
    titleInput.required = true;
    titleInput.value = article.title;
    addField(reviewForm, 'Title', titleInput, true);

    const bodyInput = makeTextArea('draft-body', 'Article content', 18, 30_000);
    bodyInput.required = true;
    bodyInput.value = articleBody(article, sources);
    addField(reviewForm, 'Article content', bodyInput, true, 'Edit the text and headings before saving. Use “## Heading” for section headings. The visitor preview updates as you type.');

    const previewPane = element('section', styles.previewPane);
    previewPane.setAttribute('aria-label', 'Visitor-style article preview');
    const previewHeader = element('div', styles.previewHeader);
    const previewHeading = element('h4', styles.workflowSectionTitle);
    previewHeading.textContent = 'Visitor preview';
    const previewNote = element('p', styles.workflowHint);
    previewNote.textContent = 'Approximate content preview; Wix controls the final published blog theme and styling.';
    previewHeader.append(previewHeading, previewNote);
    const visitorPreview = element('article', styles.visitorPreview);
    const visitorTitle = element('h1', styles.visitorTitle);
    visitorTitle.textContent = titleInput.value;
    const visitorBody = element('div', styles.visitorBody);
    renderPreviewContent(visitorBody, bodyInput.value, sources);
    visitorPreview.append(visitorTitle, visitorBody);
    previewPane.append(previewHeader, visitorPreview);

    titleInput.addEventListener('input', () => {
      visitorTitle.textContent = titleInput.value.trim() || 'Your article title';
    });
    bodyInput.addEventListener('input', () => {
      renderPreviewContent(visitorBody, bodyInput.value, sources);
    });

    const meta = element('div', styles.metadataCard);
    const metaHeading = element('strong');
    metaHeading.textContent = 'Suggested meta description';
    const metaText = element('p');
    metaText.textContent = article.metaDescription;
    meta.append(metaHeading, metaText);

    const keywordGroup = element('div', styles.metadataCard);
    const keywordHeading = element('strong');
    keywordHeading.textContent = 'Suggested SEO keywords';
    keywordGroup.appendChild(keywordHeading);
    renderKeywords(keywordGroup, article.seoKeywords);

    const createButton = element('button', styles.button);
    createButton.type = 'submit';
    createButton.textContent = 'Create unpublished draft';
    reviewForm.append(createButton);
    editorPane.append(editorHeading, reviewForm);
    editorPreviewGrid.append(editorPane, previewPane);
    review.append(heading, note, editorPreviewGrid, meta, keywordGroup);
    renderResearchSources(review, sources);

    reviewForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!reviewForm.reportValidity()) return;

      createButton.disabled = true;
      createButton.textContent = 'Saving draft…';
      setStatus('Checking Wix Blog and saving the unpublished draft…');
      currentSubmissionId ??= crypto.randomUUID();

      try {
        const result = await postJson<ApiSuccess<{ draft: { draftId: string; status: string } }>>(
          '/api/workflow/drafts',
          {
            submissionId: currentSubmissionId,
            title: titleInput.value,
            body: bodyInput.value,
            metaDescription: article.metaDescription,
            seoKeywords: article.seoKeywords,
          },
        );

        if (!result.draft?.draftId || result.draft.status !== 'UNPUBLISHED') {
          throw new Error('Wix did not confirm an unpublished draft. Check Wix Blog before retrying.');
        }

        setStatus(`Saved as an unpublished Wix Blog draft (${result.draft.draftId}). It has not been published.`, 'success');
        createButton.textContent = 'Draft saved';
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'Unable to save the draft. Check Wix Blog before retrying.', 'error');
        createButton.disabled = false;
        createButton.textContent = 'Retry draft creation';
      }
    });
  };

  briefForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!briefForm.reportValidity()) return;

    generateButton.disabled = true;
    generateButton.textContent = 'Generating…';
    review.replaceChildren();
    setStatus('Generating a structured article…');

    try {
      const result = await postJson<ApiSuccess<{ article: GeneratedArticle; sources: ResearchSource[] }>>(
        '/api/workflow/generate',
        {
          topic: topic.value,
          audience: audience.value,
          tone: tone.value,
          instructions: instructions.value,
          seoKeywords: keywords.value,
          researchUrls: researchUrls.value.split(/\r?\n/).map((url) => url.trim()).filter(Boolean),
        },
      );

      if (!result.article?.title || !Array.isArray(result.article.sections)) {
        throw new Error('The generated article could not be read. Please try again.');
      }

      const sources = Array.isArray(result.sources) ? result.sources : [];
      renderReview(result.article, sources);
      setStatus(
        sources.length
          ? `Article generated with ${sources.length} retrieved research source(s). Check citations and preview before saving a draft.`
          : 'Article generated. Review the visitor preview and edit it before deciding whether to save a draft.',
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Article generation failed. Please try again.', 'error');
    } finally {
      generateButton.disabled = false;
      generateButton.textContent = 'Generate article';
    }
  });
}
