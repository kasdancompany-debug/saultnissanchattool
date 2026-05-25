"use client";

import { useCallback, useMemo, useState } from "react";

import type { InboxSort } from "@/lib/inbox/inbox-sort";
import type { InboxFilter } from "@/lib/inbox/inbox-filter";
import type { InboxConversationListItem } from "@/lib/inbox/inbox-list-item";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

import { ConversationListRow } from "./conversation-list-row";
import { InboxDeleteForeverControl } from "./inbox-delete-forever-control";

const checkboxClassName =
  "border-input accent-foreground/80 focus-visible:ring-ring size-3.5 rounded border shadow-sm focus-visible:ring-2 focus-visible:outline-none";

export function ConversationListWithBulkDelete({
  items,
  filter,
  sort,
  assigneeScopeUserId,
  selectedConversationId,
  currentStaffUserId,
  canDeleteForever,
}: {
  items: InboxConversationListItem[];
  filter: InboxFilter;
  sort: InboxSort;
  assigneeScopeUserId: string | null;
  selectedConversationId: string | null;
  currentStaffUserId: string;
  canDeleteForever: boolean;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const allIds = useMemo(() => items.map((item) => item.id), [items]);
  const selectedCount = selectedIds.size;
  const allSelected = items.length > 0 && selectedCount === items.length;
  const someSelected = selectedCount > 0 && !allSelected;

  const toggleOne = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === items.length) {
        return new Set();
      }
      return new Set(allIds);
    });
  }, [allIds, items.length]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectedIdList = useMemo(() => [...selectedIds], [selectedIds]);

  return (
    <>
      {canDeleteForever ? (
        <div
          className={cn(
            "shrink-0 border-b px-4 py-2.5 sm:px-5",
            selectedCount > 0
              ? "border-amber-500/20 bg-amber-500/[0.06]"
              : "border-border/50 bg-muted/15"
          )}
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <label className="text-foreground flex cursor-pointer items-center gap-2.5 text-[11px] font-medium">
              <input
                type="checkbox"
                className={checkboxClassName}
                checked={allSelected}
                ref={(el) => {
                  if (el) {
                    el.indeterminate = someSelected;
                  }
                }}
                onChange={toggleAll}
                aria-label={allSelected ? "Clear selection" : "Select all in this list"}
              />
              <span>
                {selectedCount > 0
                  ? `${selectedCount} selected`
                  : "Select all"}
              </span>
            </label>

            {selectedCount > 0 ? (
              <>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground text-[11px] font-medium underline-offset-2 hover:underline"
                  onClick={clearSelection}
                >
                  Clear
                </button>
                <div className="ms-auto min-w-0">
                  <InboxDeleteForeverControl
                    conversationIds={selectedIdList}
                    filter={filter}
                    sort={sort}
                    assigneeScopeUserId={assigneeScopeUserId}
                    onDeleted={clearSelection}
                  />
                </div>
              </>
            ) : (
              <p className="text-muted-foreground ms-auto text-[10px] font-normal">
                Select threads to remove permanently
              </p>
            )}
          </div>
        </div>
      ) : null}

      <ScrollArea className="min-h-0 flex-1">
        <ul className="flex flex-col gap-1.5 p-2 pb-5 sm:p-2.5">
          {items.map((item) => (
            <li key={item.id}>
              <ConversationListRow
                item={item}
                filter={filter}
                sort={sort}
                assigneeScopeUserId={assigneeScopeUserId}
                isSelected={item.id === selectedConversationId}
                currentStaffUserId={currentStaffUserId}
                bulkSelect={
                  canDeleteForever
                    ? {
                        checked: selectedIds.has(item.id),
                        onCheckedChange: (checked) =>
                          toggleOne(item.id, checked),
                      }
                    : undefined
                }
              />
            </li>
          ))}
        </ul>
      </ScrollArea>
    </>
  );
}
