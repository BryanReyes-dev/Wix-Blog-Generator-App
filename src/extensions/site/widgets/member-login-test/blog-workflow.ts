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

function articleBody(article: GeneratedArticle): string {
  return [
    '## Introduction',
    article.introduction,
    ...article.sections.flatMap((section) => [`## ${section.heading}`, section.body]),
    '## Conclusion',
    article.conclusion,
  ].join('\n\n');
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

  const renderReview = (article: GeneratedArticle) => {
    review.replaceChildren();
    currentSubmissionId = null;

    const heading = element('h3', styles.workflowSectionTitle);
    heading.textContent = 'Review and edit';
    const note = element('p', styles.workflowIntro);
    note.textContent = 'Nothing is saved to Wix Blog until you choose “Create unpublished draft.”';
    const reviewForm = element('form', styles.workflowForm);

    const titleInput = makeInput('draft-title', 'Article title', 200);
    titleInput.required = true;
    titleInput.value = article.title;
    addField(reviewForm, 'Title', titleInput, true);

    const bodyInput = makeTextArea('draft-body', 'Article content', 18, 30_000);
    bodyInput.required = true;
    bodyInput.value = articleBody(article);
    addField(reviewForm, 'Article content', bodyInput, true, 'Edit the text and headings before saving. Use “## Heading” for section headings.');

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
    review.append(heading, note, reviewForm, meta, keywordGroup);

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
      const result = await postJson<ApiSuccess<{ article: GeneratedArticle }>>(
        '/api/workflow/generate',
        {
          topic: topic.value,
          audience: audience.value,
          tone: tone.value,
          instructions: instructions.value,
          seoKeywords: keywords.value,
        },
      );

      if (!result.article?.title || !Array.isArray(result.article.sections)) {
        throw new Error('The generated article could not be read. Please try again.');
      }

      renderReview(result.article);
      setStatus('Article generated. Review and edit it before deciding whether to save a draft.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Article generation failed. Please try again.', 'error');
    } finally {
      generateButton.disabled = false;
      generateButton.textContent = 'Generate article';
    }
  });
}
