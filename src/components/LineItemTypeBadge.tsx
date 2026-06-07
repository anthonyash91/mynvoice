import { LINE_ITEM_KIND_LABEL, type LineItemKind } from '@/lib/lineItem';

export function LineItemTypeBadge({ kind }: { kind: LineItemKind }) {
  return (
    <span
      className="inline-flex w-fit shrink-0 rounded border border-border bg-secondary/80 px-1.5 py-px text-[10px] font-medium uppercase leading-tight tracking-wide text-muted-foreground"
      aria-label={`${LINE_ITEM_KIND_LABEL[kind]} line item`}
    >
      {LINE_ITEM_KIND_LABEL[kind]}
    </span>
  );
}
