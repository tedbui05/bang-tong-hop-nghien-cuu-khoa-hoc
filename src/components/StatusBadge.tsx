import { STATUS_ICON_PATHS, STATUS_LABELS } from "@/lib/sheet";
import type { LabelKey } from "@/lib/types";

export function StatusIcon({ label }: { label: LabelKey }) {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={STATUS_ICON_PATHS[label]} />
    </svg>
  );
}

export function StatusBadge({ label }: { label: LabelKey }) {
  return (
    <span className={`badge badge--${label}`}>
      <StatusIcon label={label} />
      {STATUS_LABELS[label]}
    </span>
  );
}
