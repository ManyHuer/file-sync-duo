import { EmptyDocIcon } from "./icons";

export function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="empty-state">
      <EmptyDocIcon />
      <p className="empty-title">{title}</p>
      <p className="empty-hint">{hint}</p>
    </div>
  );
}
