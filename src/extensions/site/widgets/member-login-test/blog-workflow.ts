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

type ResearchLink = { id: string; url: string; notes: string };
type ResearchSource = {
  id: string;
  title: string;
  url: string;
  publisher: string;
  retrievedAt: string;
  excerpt: string;
  userNotes?: string;
};
type MediaFrame = { label: string; dataUrl: string };
type MediaReference = {
  id: string;
  name: string;
  kind: 'image' | 'video';
  notes: string;
  frames: MediaFrame[];
  originalBytes: number;
};
type MemberIdentity = { memberId: string; displayName: string };
type Theme = 'dark' | 'light';
type Preferences = {
  theme: Theme;
  topic: string;
  audience: string;
  tone: string;
  instructions: string;
  keywords: string;
  researchLinks: Array<{ url: string; notes: string }>;
};

type ApiError = { error?: string };
type ApiSuccess<T> = T & { error?: never };

const API_BASE_URL = new URL(import.meta.url).origin;
const MAX_RESEARCH_LINKS = 5;
const MAX_MEDIA_FILES = 4;
const MAX_VISUAL_FRAMES = 8;
const MAX_SINGLE_FRAME_CHARS = 850_000;
const MAX_MEDIA_REFERENCE_CHARS = 3_500_000;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const ACCEPTED_VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);

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

function makeActionButton(label: string, className = styles.secondaryButton): HTMLButtonElement {
  const button = element('button', className);
  button.type = 'button';
  button.textContent = label;
  return button;
}

function makeId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : String(Date.now()) + '-' + Math.random().toString(36).slice(2);
}

function makeSubmissionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') {
    throw new Error('This browser cannot create a secure draft submission ID. Use a current browser and try again.');
  }

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' +
    hex.slice(16, 20) + '-' + hex.slice(20);
}

function loadPreferences(storageKey: string | null): Partial<Preferences> {
  if (!storageKey) return {};
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return {};
    const value = JSON.parse(raw) as Partial<Preferences>;
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

function savePreferences(storageKey: string | null, preferences: Preferences) {
  if (!storageKey) return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(preferences));
  } catch {
    // Browser privacy settings or storage quotas must not block article generation.
  }
}

function articleBody(article: GeneratedArticle, sources: ResearchSource[] = []): string {
  const body = [
    '## Introduction',
    article.introduction,
    ...article.sections.flatMap((section) => ['## ' + section.heading, section.body]),
    '## Conclusion',
    article.conclusion,
  ];
  const articleText = body.join('\n');
  const citedIds = new Set([...articleText.matchAll(/\[(S\d+)\]/g)].map((match) => match[1]));
  const citedSources = sources.filter((source) => citedIds.has(source.id));

  if (citedSources.length > 0) {
    body.push('## Sources');
    for (const source of citedSources) {
      body.push('- [' + source.id + '] ' + source.title + ' — ' + source.url);
    }
  }

  return body.join('\n\n');
}

function appendSafePreviewText(parent: HTMLElement, value: string, sources: ResearchSource[]) {
  const tokens = value.split(/(\[S\d+\]|https?:\/\/[^\s<>"']+|\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g).filter(Boolean);

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
        link.setAttribute('aria-label', 'Open research source ' + source.id + ' in a new tab');
        superscript.appendChild(link);
        parent.appendChild(superscript);
      } else {
        parent.appendChild(document.createTextNode(token));
      }
      continue;
    }

    if (token.startsWith('**') && token.endsWith('**')) {
      const strong = element('strong');
      appendSafePreviewText(strong, token.slice(2, -2), sources);
      parent.appendChild(strong);
      continue;
    }
    if (token.startsWith('*') && token.endsWith('*')) {
      const emphasis = element('em');
      appendSafePreviewText(emphasis, token.slice(1, -1), sources);
      parent.appendChild(emphasis);
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

function renderPreviewContent(parent: HTMLElement, body: string, sources: ResearchSource[]) {
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

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      list = null;
      continue;
    }

    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      flushParagraph();
      list = null;
      const level = Math.min(4, Math.max(2, headingMatch[1]?.length ?? 2));
      const heading = level === 2 ? element('h2') : level === 3 ? element('h3') : element('h4');
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

    const quoteMatch = /^>\s?(.+)$/.exec(trimmed);
    if (quoteMatch) {
      flushParagraph();
      list = null;
      const quote = element('blockquote');
      appendSafePreviewText(quote, quoteMatch[1] ?? '', sources);
      parent.appendChild(quote);
      continue;
    }

    list = null;
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
    link.textContent = '[' + source.id + '] ' + source.title;
    item.appendChild(link);

    const metadata = element('small');
    metadata.textContent = source.publisher + ' · Retrieved ' + new Date(source.retrievedAt).toLocaleString();
    item.appendChild(metadata);
    if (source.userNotes) {
      const note = element('p');
      note.textContent = 'Your focus: ' + source.userNotes;
      item.appendChild(note);
    }
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

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function waitForEvent(target: EventTarget, successEvent: string, errorEvent: string, timeoutMs = 12_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => finish(new Error('Timed out while reading the media file.')), timeoutMs);
    const onSuccess = () => finish();
    const onError = () => finish(new Error('This media file could not be decoded in your browser.'));
    const finish = (error?: Error) => {
      window.clearTimeout(timer);
      target.removeEventListener(successEvent, onSuccess);
      target.removeEventListener(errorEvent, onError);
      if (error) reject(error);
      else resolve();
    };
    target.addEventListener(successEvent, onSuccess, { once: true });
    target.addEventListener(errorEvent, onError, { once: true });
  });
}

function canvasJpeg(source: CanvasImageSource, width: number, height: number, label: string): MediaFrame {
  const maxDimension = 1440;
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  const baseWidth = Math.max(1, Math.round(width * scale));
  const baseHeight = Math.max(1, Math.round(height * scale));
  const dimensionScales = [1, 0.82, 0.68, 0.55];
  const qualities = [0.78, 0.65, 0.52];

  for (const dimensionScale of dimensionScales) {
    const outputWidth = Math.max(1, Math.round(baseWidth * dimensionScale));
    const outputHeight = Math.max(1, Math.round(baseHeight * dimensionScale));
    const canvas = document.createElement('canvas');
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Your browser could not prepare this image.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, outputWidth, outputHeight);
    context.drawImage(source, 0, 0, outputWidth, outputHeight);
    for (const quality of qualities) {
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      if (dataUrl.length <= MAX_SINGLE_FRAME_CHARS) return { label, dataUrl };
    }
  }
  throw new Error('This image is too detailed to attach. Try a smaller image.');
}

async function imageReference(file: File): Promise<MediaFrame> {
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  try {
    const loaded = waitForEvent(image, 'load', 'error');
    image.src = objectUrl;
    await loaded;
    return canvasJpeg(image, image.naturalWidth, image.naturalHeight, 'Image');
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function videoReferenceFrames(file: File, maxFrames: number): Promise<MediaFrame[]> {
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.muted = true;
  video.playsInline = true;

  try {
    const metadataLoaded = waitForEvent(video, 'loadedmetadata', 'error');
    video.src = objectUrl;
    video.load();
    await metadataLoaded;
    if (!Number.isFinite(video.duration) || video.duration <= 0 || !video.videoWidth || !video.videoHeight) {
      throw new Error('This video has no readable visual frames.');
    }

    const positions = [0.18, 0.5, 0.82].slice(0, Math.max(1, Math.min(3, maxFrames)));
    const frames: MediaFrame[] = [];
    for (const position of positions) {
      const time = Math.max(0, Math.min(video.duration - 0.08, video.duration * position));
      if (Math.abs(video.currentTime - time) > 0.02) {
        const seeked = waitForEvent(video, 'seeked', 'error');
        video.currentTime = time;
        await seeked;
      }
      frames.push(canvasJpeg(video, video.videoWidth, video.videoHeight, 'Frame at ' + Math.round(position * 100) + '%'));
    }
    return frames;
  } finally {
    video.pause();
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(objectUrl);
  }
}

function getMediaKind(file: File): 'image' | 'video' | null {
  const extension = file.name.toLowerCase().split('.').pop() ?? '';
  const mimeType = file.type.toLowerCase();
  if (ACCEPTED_IMAGE_TYPES.has(mimeType) || ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extension)) return 'image';
  if (ACCEPTED_VIDEO_TYPES.has(mimeType) || ['mp4', 'webm', 'mov'].includes(extension)) return 'video';
  return null;
}

function insertMarkdown(textarea: HTMLTextAreaElement, action: 'heading' | 'bold' | 'italic' | 'bullet' | 'quote') {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = textarea.value.slice(start, end) || 'Text';
  let replacement = selected;
  let selectionStart = start;
  let selectionEnd: number;

  if (action === 'bold') replacement = '**' + selected + '**';
  if (action === 'italic') replacement = '*' + selected + '*';
  if (action === 'heading') {
    const lineStart = textarea.value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
    textarea.setRangeText('## ', lineStart, lineStart, 'end');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.focus();
    return;
  }
  if (action === 'bullet') replacement = selected.split('\n').map((line) => '- ' + line).join('\n');
  if (action === 'quote') replacement = selected.split('\n').map((line) => '> ' + line).join('\n');

  textarea.setRangeText(replacement, start, end, 'select');
  selectionStart = start;
  selectionEnd = start + replacement.length;
  textarea.setSelectionRange(selectionStart, selectionEnd);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.focus();
}

export function mountBlogWorkflow(
  container: HTMLElement,
  signOut: () => Promise<void>,
  identity: MemberIdentity,
) {
  container.innerHTML = '';
  const storageKey = identity.memberId
    ? 'wix-blog-generator:preferences:v1:' + identity.memberId
    : null;
  const saved = loadPreferences(storageKey);
  const safeLinks = Array.isArray(saved.researchLinks)
    ? saved.researchLinks.slice(0, MAX_RESEARCH_LINKS).filter((entry) => entry && typeof entry.url === 'string')
    : [];
  let researchLinks: ResearchLink[] = safeLinks.map((entry) => ({
    id: makeId(),
    url: entry.url,
    notes: typeof entry.notes === 'string' ? entry.notes.slice(0, 500) : '',
  }));
  let mediaReferences: MediaReference[] = [];
  let generatedByMemberId = '';
  let currentSubmissionId: string | null = null;

  const root = element('div', styles.workflowRoot);
  root.dataset.theme = saved.theme === 'light' ? 'light' : 'dark';

  const topBar = element('header', styles.workflowTopBar);
  const intro = element('div', styles.workflowHeaderCopy);
  const eyebrow = element('p', styles.workflowEyebrow);
  eyebrow.textContent = 'EDITORIAL WORKSPACE';
  const title = element('h2', styles.title);
  title.textContent = 'Create a Wix Blog draft';
  const copy = element('p', styles.workflowIntro);
  copy.textContent = 'Build your brief, add research and visual references, then edit and preview before saving an unpublished draft.';
  intro.append(eyebrow, title, copy);

  const menuButton = makeActionButton('Menu', styles.mobileMenuButton);
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', 'Open workflow menu');
  const actions = element('div', styles.workflowActions);
  const themeButton = makeActionButton('Switch to light mode');
  themeButton.setAttribute('aria-label', 'Switch to light mode');
  const signOutButton = makeActionButton('Sign out');
  signOutButton.addEventListener('click', async () => {
    signOutButton.disabled = true;
    try {
      await signOut();
    } catch {
      setStatus('Sign-out could not be completed. Please try again.', 'error');
      signOutButton.disabled = false;
    }
  });
  actions.append(themeButton, signOutButton);
  topBar.append(intro, menuButton, actions);

  const status = element('p', styles.status);
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  const workspace = element('div', styles.workspaceGrid);
  const briefPanel = element('section', styles.workflowPanel);
  const briefHeading = element('div', styles.panelHeading);
  const briefTitle = element('h3', styles.workflowSectionTitle);
  briefTitle.textContent = 'Article brief';
  const briefSubheading = element('p', styles.workflowHint);
  briefSubheading.textContent = 'Your preferences are remembered for this Wix member account in this browser.';
  briefHeading.append(briefTitle, briefSubheading);

  const briefForm = element('form', styles.workflowForm);
  const topic = makeInput('blog-topic', 'Topic or working title', 200);
  topic.required = true;
  topic.value = typeof saved.topic === 'string' ? saved.topic : '';
  addField(briefForm, 'Topic or working title', topic, true);

  const audience = makeInput('blog-audience', 'Who should this article help?', 300);
  audience.required = true;
  audience.value = typeof saved.audience === 'string' ? saved.audience : '';
  addField(briefForm, 'Target audience', audience, true);

  const tone = makeInput('blog-tone', 'For example: warm, practical, and confident', 120);
  tone.required = true;
  tone.value = typeof saved.tone === 'string' ? saved.tone : '';
  addField(briefForm, 'Writing tone', tone, true);

  const instructions = makeTextArea('blog-instructions', 'Include the points, examples, or instructions the article should cover.', 5, 3_000);
  instructions.required = true;
  instructions.value = typeof saved.instructions === 'string' ? saved.instructions : '';
  addField(briefForm, 'Main points or instructions', instructions, true);

  const keywords = makeInput('blog-keywords', 'Separate keywords with commas', 400);
  keywords.value = typeof saved.keywords === 'string' ? saved.keywords : '';
  addField(briefForm, 'Optional SEO keywords', keywords, false, 'Up to five suggested keywords.');

  const linkField = element('div', styles.workflowField);
  const linkHeader = element('div', styles.fieldHeader);
  const linkLabel = element('span', styles.workflowLabel);
  linkLabel.textContent = 'Research links';
  const addLinkButton = makeActionButton('+ Add link', styles.addItemButton);
  addLinkButton.setAttribute('aria-label', 'Add a research link');
  linkHeader.append(linkLabel, addLinkButton);
  const linkDescription = element('small', styles.workflowHint);
  linkDescription.textContent = 'Add up to five public web pages. You can tell the model what to focus on for each link.';
  const researchLinkList = element('div', styles.researchLinkList);
  linkField.append(linkHeader, linkDescription, researchLinkList);
  briefForm.appendChild(linkField);

  const mediaField = element('div', styles.workflowField);
  const mediaHeader = element('div', styles.fieldHeader);
  const mediaLabel = element('span', styles.workflowLabel);
  mediaLabel.textContent = 'Visual reference files';
  const addMediaButton = makeActionButton('+ Add files', styles.addItemButton);
  addMediaButton.setAttribute('aria-label', 'Add image or video reference files');
  mediaHeader.append(mediaLabel, addMediaButton);
  const mediaDescription = element('small', styles.workflowHint);
  mediaDescription.textContent = 'PNG, JPG/JPEG, WebP, GIF, MP4, MOV, or WebM. Images are resized for AI analysis; videos contribute up to three sampled frames each. Video audio is not analyzed. Reference files are not automatically embedded in the saved blog post.';
  const fileInput = element('input', styles.hiddenFileInput);
  fileInput.type = 'file';
  fileInput.multiple = true;
  fileInput.accept = '.jpg,.jpeg,.png,.webp,.gif,.mp4,.mov,.webm,image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm';
  fileInput.setAttribute('aria-label', 'Choose images or videos');
  const mediaReferenceList = element('div', styles.mediaReferenceList);
  mediaField.append(mediaHeader, mediaDescription, fileInput, mediaReferenceList);
  briefForm.appendChild(mediaField);

  const generateButton = element('button', styles.button);
  generateButton.type = 'submit';
  generateButton.textContent = 'Generate article';
  briefForm.appendChild(generateButton);
  briefPanel.append(briefHeading, briefForm);

  const sidebar = element('aside', styles.workflowPanel);
  const sidebarTitle = element('h3', styles.workflowSectionTitle);
  sidebarTitle.textContent = 'Workflow tips';
  const sidebarList = element('ul', styles.workflowTips);
  for (const tip of [
    'Add a short focus note to a link when you want one specific fact or angle emphasized.',
    'Use image references for visual context and video references for sampled frames.',
    'Your selected files stay in memory for this session; text settings are saved per member.',
    'Generation does not create a post. You decide when to save an unpublished draft.',
  ]) {
    const item = element('li');
    item.textContent = tip;
    sidebarList.appendChild(item);
  }
  sidebar.append(sidebarTitle, sidebarList);
  workspace.append(briefPanel, sidebar);

  const review = element('section', styles.reviewSection);
  review.setAttribute('aria-label', 'Review generated article');
  root.append(topBar, status, workspace, review);
  container.appendChild(root);

  const setStatus = (message: string, kind: 'info' | 'error' | 'success' = 'info') => {
    status.textContent = message;
    status.className = styles.status;
    if (kind === 'error') status.classList.add(styles.errorNotice);
    if (kind === 'success') status.classList.add(styles.successNotice);
  };

  const currentPreferences = (): Preferences => ({
    theme: root.dataset.theme === 'light' ? 'light' : 'dark',
    topic: topic.value,
    audience: audience.value,
    tone: tone.value,
    instructions: instructions.value,
    keywords: keywords.value,
    researchLinks: researchLinks.map((link) => ({ url: link.url, notes: link.notes })).filter((link) => link.url.trim()),
  });
  const persistPreferences = () => savePreferences(storageKey, currentPreferences());
  for (const field of [topic, audience, tone, instructions, keywords]) {
    field.addEventListener('input', persistPreferences);
  }

  const updateThemeButton = () => {
    const nextLabel = root.dataset.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
    themeButton.textContent = nextLabel;
    themeButton.setAttribute('aria-label', nextLabel);
    themeButton.setAttribute('aria-pressed', String(root.dataset.theme === 'light'));
  };
  updateThemeButton();
  themeButton.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    updateThemeButton();
    persistPreferences();
  });

  menuButton.addEventListener('click', () => {
    const open = topBar.classList.toggle(styles.menuOpen);
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Close workflow menu' : 'Open workflow menu');
    menuButton.textContent = open ? 'Close' : 'Menu';
  });

  const renderResearchLinks = () => {
    researchLinkList.replaceChildren();
    if (researchLinks.length === 0) {
      const empty = element('p', styles.emptyState);
      empty.textContent = 'No research links added yet. Select “+ Add link” to start.';
      researchLinkList.appendChild(empty);
    }

    researchLinks.forEach((entry, index) => {
      const row = element('div', styles.researchLinkRow);
      const fields = element('div', styles.researchLinkFields);
      const urlField = element('div', styles.workflowField);
      const urlLabel = element('label', styles.workflowLabel);
      const urlInput = element('input', styles.workflowInput);
      const urlId = 'research-url-' + entry.id;
      urlLabel.htmlFor = urlId;
      urlLabel.textContent = 'URL ' + (index + 1);
      urlInput.id = urlId;
      urlInput.name = urlId;
      urlInput.type = 'url';
      urlInput.maxLength = 2_048;
      urlInput.placeholder = 'https://example.com/article';
      urlInput.value = entry.url;
      urlField.append(urlLabel, urlInput);

      const noteField = element('div', styles.workflowField);
      const noteLabel = element('label', styles.workflowLabel);
      const noteInput = makeTextArea('research-note-' + entry.id, 'Optional: what should the model focus on in this source?', 2, 500);
      noteLabel.htmlFor = noteInput.id;
      noteLabel.textContent = 'Source focus note (optional)';
      noteInput.value = entry.notes;
      noteField.append(noteLabel, noteInput);
      fields.append(urlField, noteField);

      const remove = makeActionButton('×', styles.iconButton);
      remove.setAttribute('aria-label', 'Remove research link ' + (index + 1));
      remove.title = 'Remove link';
      remove.addEventListener('click', () => {
        researchLinks = researchLinks.filter((link) => link.id !== entry.id);
        renderResearchLinks();
        persistPreferences();
      });
      urlInput.addEventListener('input', () => {
        entry.url = urlInput.value;
        persistPreferences();
      });
      noteInput.addEventListener('input', () => {
        entry.notes = noteInput.value;
        persistPreferences();
      });

      row.append(fields, remove);
      researchLinkList.appendChild(row);
    });
    addLinkButton.disabled = researchLinks.length >= MAX_RESEARCH_LINKS;
    addLinkButton.title = addLinkButton.disabled ? 'You can add up to five research links' : 'Add another research link';
  };

  addLinkButton.addEventListener('click', () => {
    if (researchLinks.length >= MAX_RESEARCH_LINKS) return;
    researchLinks.push({ id: makeId(), url: '', notes: '' });
    renderResearchLinks();
    persistPreferences();
    const urlInputs = researchLinkList.querySelectorAll<HTMLInputElement>('input[type="url"]');
    urlInputs.item(urlInputs.length - 1)?.focus();
  });
  renderResearchLinks();

  const renderMediaReferences = () => {
    mediaReferenceList.replaceChildren();
    if (mediaReferences.length === 0) {
      const empty = element('p', styles.emptyState);
      empty.textContent = 'No reference files attached.';
      mediaReferenceList.appendChild(empty);
    }

    mediaReferences.forEach((reference) => {
      const card = element('div', styles.mediaReferenceCard);
      const preview = element('img', styles.mediaThumbnail);
      preview.src = reference.frames[0]?.dataUrl ?? '';
      preview.alt = reference.name + ' preview';
      const content = element('div', styles.mediaReferenceContent);
      const fileTitleRow = element('div', styles.mediaFileTitleRow);
      const fileTitle = element('strong');
      fileTitle.textContent = reference.name;
      const detail = element('small', styles.workflowHint);
      detail.textContent = (reference.kind === 'video' ? 'Video · ' + reference.frames.length + ' sampled frames' : 'Image reference') + ' · ' + formatBytes(reference.originalBytes);
      fileTitleRow.append(fileTitle, detail);
      const noteInput = makeTextArea('media-note-' + reference.id, 'Optional context for the model (up to 500 characters)', 2, 500);
      noteInput.value = reference.notes;
      noteInput.setAttribute('aria-label', 'Context for ' + reference.name);
      noteInput.addEventListener('input', () => {
        reference.notes = noteInput.value;
      });
      content.append(fileTitleRow, noteInput);
      const remove = makeActionButton('×', styles.iconButton);
      remove.setAttribute('aria-label', 'Remove file ' + reference.name);
      remove.addEventListener('click', () => {
        mediaReferences = mediaReferences.filter((item) => item.id !== reference.id);
        renderMediaReferences();
      });
      card.append(preview, content, remove);
      mediaReferenceList.appendChild(card);
    });
  };

  addMediaButton.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const selectedFiles = Array.from(fileInput.files ?? []);
    fileInput.value = '';
    if (selectedFiles.length === 0) return;

    for (const file of selectedFiles) {
      if (mediaReferences.length >= MAX_MEDIA_FILES) {
        setStatus('Attach up to ' + MAX_MEDIA_FILES + ' reference files. Remove a file before adding another.', 'error');
        break;
      }
      const kind = getMediaKind(file);
      if (!kind) {
        setStatus('Unsupported file type for ' + file.name + '. Use JPG, PNG, WebP, GIF, MP4, MOV, or WebM.', 'error');
        continue;
      }
      const sizeLimit = kind === 'image' ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
      if (file.size <= 0 || file.size > sizeLimit) {
        setStatus(file.name + ' is too large. Images must be 20 MB or less; videos must be 100 MB or less.', 'error');
        continue;
      }

      const existingFrameCount = mediaReferences.reduce((total, reference) => total + reference.frames.length, 0);
      const remainingFrames = MAX_VISUAL_FRAMES - existingFrameCount;
      if (remainingFrames <= 0) {
        setStatus('You can attach up to ' + MAX_VISUAL_FRAMES + ' visual frames. Remove a reference to make room.', 'error');
        break;
      }

      try {
        setStatus('Preparing ' + file.name + ' for visual analysis…');
        const frames = kind === 'image'
          ? [await imageReference(file)]
          : await videoReferenceFrames(file, remainingFrames);
        const currentEncodedChars = mediaReferences.reduce((total, reference) =>
          total + reference.frames.reduce((frameTotal, frame) => frameTotal + frame.dataUrl.length, 0), 0);
        const incomingEncodedChars = frames.reduce((total, frame) => total + frame.dataUrl.length, 0);
        if (currentEncodedChars + incomingEncodedChars > MAX_MEDIA_REFERENCE_CHARS) {
          setStatus('Reference images are too large together. Remove a file or use smaller files.', 'error');
          continue;
        }
        mediaReferences.push({
          id: makeId(),
          name: file.name.slice(0, 160),
          kind,
          notes: '',
          frames,
          originalBytes: file.size,
        });
        renderMediaReferences();
        setStatus('Attached ' + file.name + ' as a visual reference.');
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'Could not read ' + file.name + '.', 'error');
      }
    }
  });
  renderMediaReferences();

  const renderReview = (article: GeneratedArticle, sources: ResearchSource[], generatedBy: string) => {
    review.replaceChildren();
    currentSubmissionId = null;
    const heading = element('h3', styles.workflowSectionTitle);
    heading.textContent = 'Review and edit';
    const note = element('p', styles.workflowIntro);
    note.textContent = 'Nothing is saved to Wix Blog until you choose “Create unpublished draft.”';

    const attribution = element('div', styles.attributionBar);
    const authorLabel = element('span', styles.attributionPill);
    authorLabel.textContent = 'Generated by ' + identity.displayName;
    const authorDetail = element('small', styles.workflowHint);
    authorDetail.textContent = 'Wix member identity verified by the server';
    attribution.append(authorLabel, authorDetail);

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
    addField(reviewForm, 'Article content', bodyInput, true, 'Use the toolbar to format selected text. Headings use Markdown-style “## Heading”.');

    const toolbar = element('div', styles.editorToolbar);
    const toolbarActions: Array<{ label: string; action: 'heading' | 'bold' | 'italic' | 'bullet' | 'quote' }> = [
      { label: 'H2', action: 'heading' },
      { label: 'Bold', action: 'bold' },
      { label: 'Italic', action: 'italic' },
      { label: '• List', action: 'bullet' },
      { label: 'Quote', action: 'quote' },
    ];
    for (const item of toolbarActions) {
      const button = makeActionButton(item.label, styles.toolbarButton);
      button.addEventListener('click', () => insertMarkdown(bodyInput, item.action));
      toolbar.appendChild(button);
    }
    reviewForm.insertBefore(toolbar, bodyInput.parentElement ?? null);

    const metaInput = makeTextArea('draft-meta-description', 'Meta description', 3, 500);
    metaInput.value = article.metaDescription;
    addField(reviewForm, 'Meta description', metaInput, true, 'Edit the description used for search snippets.');

    const keywordsInput = makeInput('draft-seo-keywords', 'Separate up to five keywords with commas', 400);
    keywordsInput.value = article.seoKeywords.join(', ');
    addField(reviewForm, 'SEO keywords', keywordsInput, false);

    const previewPane = element('section', styles.previewPane);
    previewPane.setAttribute('aria-label', 'Visitor-style article preview');
    const previewHeader = element('div', styles.previewHeader);
    const previewHeading = element('h4', styles.workflowSectionTitle);
    previewHeading.textContent = 'Live preview';
    const previewNote = element('p', styles.workflowHint);
    previewNote.textContent = 'The preview updates as you edit. Final presentation depends on the Wix Blog theme.';
    previewHeader.append(previewHeading, previewNote);
    const visitorPreview = element('article', styles.visitorPreview);
    const visitorTitle = element('h1', styles.visitorTitle);
    visitorTitle.textContent = titleInput.value;
    const visitorMeta = element('p', styles.visitorMeta);
    visitorMeta.textContent = metaInput.value;
    const visitorBody = element('div', styles.visitorBody);
    renderPreviewContent(visitorBody, bodyInput.value, sources);
    visitorPreview.append(visitorTitle, visitorMeta, visitorBody);
    previewPane.append(previewHeader, visitorPreview);

    titleInput.addEventListener('input', () => {
      visitorTitle.textContent = titleInput.value.trim() || 'Your article title';
    });
    metaInput.addEventListener('input', () => {
      visitorMeta.textContent = metaInput.value;
    });
    bodyInput.addEventListener('input', () => {
      renderPreviewContent(visitorBody, bodyInput.value, sources);
    });

    const createButton = element('button', styles.button);
    createButton.type = 'submit';
    createButton.textContent = 'Create unpublished draft';
    reviewForm.append(createButton);

    editorPane.append(editorHeading, reviewForm);
    editorPreviewGrid.append(editorPane, previewPane);
    review.append(heading, note, attribution, editorPreviewGrid);
    renderResearchSources(review, sources);

    reviewForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!reviewForm.reportValidity()) return;
      const seoKeywords = keywordsInput.value.split(',').map((term) => term.trim()).filter(Boolean);
      if (seoKeywords.length > 5 || seoKeywords.some((term) => term.length > 80)) {
        setStatus('Use no more than five SEO keywords, each 80 characters or fewer.', 'error');
        return;
      }
      if (!generatedBy || generatedBy !== generatedByMemberId) {
        setStatus('The article creator could not be verified. Generate the article again before saving.', 'error');
        return;
      }

      createButton.disabled = true;
      createButton.textContent = 'Saving draft…';
      setStatus('Checking Wix Blog and saving the unpublished draft…');
      try {
        currentSubmissionId ??= makeSubmissionId();
        const result = await postJson<ApiSuccess<{ draft: { draftId: string; status: string } }>>(
          '/api/workflow/drafts',
          {
            submissionId: currentSubmissionId,
            generatedByMemberId: generatedBy,
            title: titleInput.value,
            body: bodyInput.value,
            metaDescription: metaInput.value,
            seoKeywords,
            researchSources: sources.map(({ id, title, url }) => ({ id, title, url })),
          },
        );

        if (!result.draft?.draftId || result.draft.status !== 'UNPUBLISHED') {
          throw new Error('Wix did not confirm an unpublished draft. Check Wix Blog before retrying.');
        }

        setStatus('Saved as an unpublished Wix Blog draft (' + result.draft.draftId + '). It has not been published.', 'success');
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
    const incompleteNotes = researchLinks.some((link) => !link.url.trim() && link.notes.trim());
    if (incompleteNotes) {
      setStatus('Add a URL or remove the notes from each research link row.', 'error');
      return;
    }
    const linksForGeneration = researchLinks
      .map((link) => ({ url: link.url.trim(), notes: link.notes.trim() }))
      .filter((link) => link.url);
    if (linksForGeneration.length > MAX_RESEARCH_LINKS) {
      setStatus('Use no more than five research links.', 'error');
      return;
    }
    const mediaCharacters = mediaReferences.reduce((total, reference) =>
      total + reference.frames.reduce((frameTotal, frame) => frameTotal + frame.dataUrl.length, 0), 0);
    if (mediaCharacters > MAX_MEDIA_REFERENCE_CHARS) {
      setStatus('Visual references are too large. Remove a file or use smaller media.', 'error');
      return;
    }

    persistPreferences();
    generateButton.disabled = true;
    generateButton.textContent = 'Generating…';
    review.replaceChildren();
    setStatus('Reading sources and generating a structured article…');

    try {
      const result = await postJson<ApiSuccess<{
        article: GeneratedArticle;
        sources: ResearchSource[];
        generatedBy: { memberId: string };
      }>>('/api/workflow/generate', {
        topic: topic.value,
        audience: audience.value,
        tone: tone.value,
        instructions: instructions.value,
        seoKeywords: keywords.value,
        researchLinks: linksForGeneration,
        mediaReferences: mediaReferences.map(({ name, kind, notes, frames }) => ({ name, kind, notes, frames })),
      });

      if (!result.article?.title || !Array.isArray(result.article.sections) ||
          typeof result.generatedBy?.memberId !== 'string' || !result.generatedBy.memberId) {
        throw new Error('The generated article or creator identity could not be verified. Please try again.');
      }

      generatedByMemberId = result.generatedBy.memberId;
      if (identity.memberId && identity.memberId !== generatedByMemberId) {
        throw new Error('The signed-in Wix member changed during generation. Refresh and generate the article again.');
      }
      const sources = Array.isArray(result.sources) ? result.sources : [];
      renderReview(result.article, sources, generatedByMemberId);
      const sourceMessage = sources.length
        ? ' with ' + sources.length + ' retrieved research source(s)'
        : '';
      const mediaMessage = mediaReferences.length
        ? ' and ' + mediaReferences.length + ' visual reference file(s)'
        : '';
      setStatus('Article generated' + sourceMessage + mediaMessage + '. Review the preview, edit the article, and save only when ready.', 'success');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Article generation failed. Please try again.', 'error');
    } finally {
      generateButton.disabled = false;
      generateButton.textContent = 'Generate article';
    }
  });
}
