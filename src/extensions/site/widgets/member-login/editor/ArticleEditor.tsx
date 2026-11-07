import { useRef, useState, type ChangeEvent } from "react";
import type { ArticleBlock, ArticleDocument, ArticleMedia, ImageBlock } from "../../../../../lib/article-document";
import AppearancePanel from "./AppearancePanel";
import EditorBlock from "./EditorBlock";
import { EditorIcon } from "./EditorIcon";

type Props = {
  value: ArticleDocument;
  onChange: (document: ArticleDocument) => void;
  onUploadImage: (file: File) => Promise<ArticleMedia>;
  reportStatus: (message: string, kind?: "info" | "error" | "success") => void;
  disabled?: boolean;
};

type NewBlockType = "heading" | "paragraph" | "list" | "quote" | "divider" | "image";

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  throw new Error("This browser cannot create a secure block ID. Update your browser and try again.");
}

function emptyBlock(type: Exclude<NewBlockType, "image">): ArticleBlock {
  const style = { backgroundColor: "", paddingTop: 0, paddingBottom: 0, fontFamily: "", fontSize: 0, color: "", textAlignment: "INHERIT" as const, lineHeight: 0 };
  const id = createId();
  switch (type) {
    case "heading": return { id, type, level: 2, text: "New section", style };
    case "paragraph": return { id, type, text: "", style };
    case "list": return { id, type, items: ["First item", "Second item"], style };
    case "quote": return { id, type, text: "", style };
    case "divider": return { id, type, style };
  }
}

export default function ArticleEditor({ value, onChange, onUploadImage, reportStatus, disabled = false }: Props) {
  const [newBlockType, setNewBlockType] = useState<NewBlockType>("paragraph");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const latestDocumentRef = useRef(value);
  latestDocumentRef.current = value;

  const updateBlock = (blockId: string, next: ArticleBlock) => {
    onChange({ ...value, blocks: value.blocks.map((block) => block.id === blockId ? next : block) });
  };

  const removeBlock = (blockId: string) => {
    if (value.blocks.length === 1) {
      reportStatus("Keep at least one content block in the article.", "error");
      return;
    }
    onChange({ ...value, blocks: value.blocks.filter((block) => block.id !== blockId) });
  };

  const moveBlock = (blockId: string, direction: -1 | 1) => {
    const blocks = [...value.blocks];
    const index = blocks.findIndex((block) => block.id === blockId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= blocks.length) return;
    const current = blocks[index];
    const next = blocks[nextIndex];
    if (!current || !next) return;
    blocks[index] = next;
    blocks[nextIndex] = current;
    onChange({ ...value, blocks });
  };

  const addBlock = () => {
    if (newBlockType === "image") {
      fileInputRef.current?.click();
      return;
    }
    onChange({ ...value, blocks: [...value.blocks, emptyBlock(newBlockType)] });
    setNewBlockType("paragraph");
  };

  const handleImageFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploadingImage(true);
    reportStatus("Uploading the original image to Wix Media Manager…");
    try {
      const media = await onUploadImage(file);
      const imageBlock: ImageBlock = {
        id: createId(),
        type: "image",
        media,
        altText: "",
        caption: "",
        alignment: "CENTER",
        width: "CONTENT",
        textWrap: false,
        borderWidth: 0,
        borderColor: "#D0D5DD",
        borderRadius: 0,
      };
      const latestDocument = latestDocumentRef.current;
      onChange({ ...latestDocument, blocks: [...latestDocument.blocks, imageBlock] });
      reportStatus("Image uploaded and ready. It has been added to the article.", "success");
    } catch (error) {
      reportStatus(error instanceof Error ? error.message : "The image could not be uploaded.", "error");
    } finally {
      setUploadingImage(false);
    }
  };

  return (
    <div className="grid min-w-0 gap-4">
      <AppearancePanel value={value.appearance} onChange={(appearance) => onChange({ ...value, appearance })}/>
      <div className="flex min-w-0 flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h3 className="m-0 text-base font-bold text-[var(--text)]">Article structure</h3>
          <p className="mb-0 mt-1 text-xs text-[var(--text-soft)]">{value.blocks.length} blocks · edit, reorder, and style each section</p>
        </div>
        <div className="flex min-w-0 gap-2">
          <label className="sr-only" htmlFor="article-add-block">Block type to add</label>
          <select id="article-add-block" className="min-h-10 min-w-0 flex-1 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-raised)] px-2 text-sm text-[var(--text)] sm:flex-none" value={newBlockType} onChange={(event) => setNewBlockType(event.target.value as NewBlockType)} disabled={disabled || uploadingImage}>
            <option value="paragraph">Paragraph</option><option value="heading">Heading</option><option value="list">Bullet list</option><option value="quote">Quote</option><option value="divider">Divider</option><option value="image">Image / GIF</option>
          </select>
          <button type="button" onClick={addBlock} disabled={disabled || uploadingImage} className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg bg-[var(--accent)] px-3 text-sm font-semibold text-[var(--accent-text)] disabled:opacity-50">
            <EditorIcon name="plus" size={16}/><span>{uploadingImage ? "Uploading…" : "Add block"}</span>
          </button>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif" className="sr-only" aria-label="Choose an image or GIF to insert" onChange={(event) => void handleImageFile(event)}/>
        </div>
      </div>
      <div className="grid min-w-0 gap-3">
        {value.blocks.map((block, index) => (
          <EditorBlock
            key={block.id}
            block={block}
            index={index}
            total={value.blocks.length}
            onChange={(next) => updateBlock(block.id, next)}
            onMove={(direction) => moveBlock(block.id, direction)}
            onRemove={() => removeBlock(block.id)}
          />
        ))}
      </div>
      <p className="m-0 text-xs leading-5 text-[var(--text-soft)]">
        Uploaded images and GIFs are retained in their original format. Image width, alignment, text wrapping, caption, alternative text, and border settings are stored with the Wix rich-content document.
      </p>
    </div>
  );
}
