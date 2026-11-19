type IconName =
  | "plus" | "heading" | "paragraph" | "list" | "quote" | "image" | "divider"
  | "arrow-up" | "arrow-down" | "trash" | "desktop" | "mobile" | "settings"
  | "chevron-down" | "eye" | "save" | "close";

const PATHS: Record<IconName, string> = {
  plus: "M12 5v14M5 12h14",
  heading: "M4 6v12M20 6v12M4 12h16",
  paragraph: "M4 6h16M4 12h10M4 18h16",
  list: "M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01",
  quote: "M10 11H5V6h5v5Zm9 0h-5V6h5v5ZM5 13v5m9-5v5",
  image: "M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M9 9h.01",
  divider: "M4 12h16",
  "arrow-up": "m6 14 6-6 6 6",
  "arrow-down": "m6 10 6 6 6-6",
  trash: "M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3",
  desktop: "M3 4h18v13H3zM8 21h8m-4-4v4",
  mobile: "M7 2h10v20H7zM11 18h2",
  settings: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM4 13.5v-3l2-.6.8-1.4-.7-2 2.1-2.1 2 .7 1.5-.8.6-2h3l.6 2 1.5.8 2-.7 2.1 2.1-.7 2 .8 1.4 2 .6v3l-2 .6-.8 1.5.7 2-2.1 2.1-2-.7-1.5.8-.6 2h-3l-.6-2-1.5-.8-2 .7-2.1-2.1.7-2-.8-1.5-2-.6Z",
  "chevron-down": "m6 9 6 6 6-6",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z",
  save: "M5 3h12l3 3v15H4V3h1Zm2 0v6h10V3M8 21v-8h8v8",
  close: "m6 6 12 12M18 6 6 18",
};

export function EditorIcon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

export type { IconName };
