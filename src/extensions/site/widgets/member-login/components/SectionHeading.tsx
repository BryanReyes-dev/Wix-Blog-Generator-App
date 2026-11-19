type Props = { title: string; description?: string };

export default function SectionHeading({ title, description }: Props) {
  return (
    <div className="grid gap-1">
      <h3 className="m-0 text-lg font-bold tracking-tight text-[var(--text)]">{title}</h3>
      {description ? (
        <p className="m-0 break-words text-sm leading-6 text-[var(--text-muted)]">{description}</p>
      ) : null}
    </div>
  );
}
