"use client";

import { useState, type ComponentType } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CapabilityItem {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}

interface CapabilityGroup {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  items: readonly CapabilityItem[];
}

interface LandingCapabilityIndexProps {
  groups: readonly CapabilityGroup[];
}

export function LandingCapabilityIndex({ groups }: LandingCapabilityIndexProps) {
  const [openGroup, setOpenGroup] = useState(0);
  const [openItem, setOpenItem] = useState(0);

  return (
    <div className="mx-auto mt-12 max-w-2xl">
      {groups.map((group, groupIndex) => {
        const isOpen = openGroup === groupIndex;
        const GroupIcon = group.icon;
        return (
          <div key={group.id} className="mb-3">
            <button
              type="button"
              onClick={() => {
                setOpenGroup(isOpen ? -1 : groupIndex);
                setOpenItem(0);
              }}
              className={cn(
                "flex w-full items-center justify-between rounded-2xl px-5 py-4 transition-colors",
                isOpen
                  ? "border border-[var(--mkt-border)] bg-[var(--mkt-surface)]"
                  : "border border-transparent bg-transparent hover:bg-[var(--mkt-surface)]/70",
              )}
              aria-expanded={isOpen}
            >
              <span className="flex items-center gap-3">
                <GroupIcon className="size-4 text-[var(--mkt-brand)]" aria-hidden />
                <span className="font-medium text-[var(--mkt-text)]">{group.label}</span>
                <span className="text-xs text-[var(--mkt-text-muted)]">{group.items.length} features</span>
              </span>
              <ChevronDown
                className={cn("size-4 text-[var(--mkt-text-muted)] transition-transform", isOpen && "rotate-180")}
                aria-hidden
              />
            </button>

            {isOpen ? (
              <div className="mt-2 overflow-hidden rounded-2xl border border-[var(--mkt-border)] bg-[var(--mkt-surface)]">
                {group.items.map((item, itemIndex) => {
                  const itemOpen = openItem === itemIndex;
                  return (
                    <div
                      key={item.title}
                      className={itemIndex === 0 ? undefined : "border-t border-[var(--mkt-border)]"}
                    >
                      <button
                        type="button"
                        onClick={() => setOpenItem(itemOpen ? -1 : itemIndex)}
                        className="flex w-full items-center justify-between px-5 py-3.5 text-left"
                        aria-expanded={itemOpen}
                      >
                        <span
                          className={cn(
                            "text-sm",
                            itemOpen ? "font-semibold text-[var(--mkt-brand)]" : "font-normal text-[var(--mkt-text)]",
                          )}
                        >
                          {item.title}
                        </span>
                        <ChevronDown
                          className={cn(
                            "ml-3 size-3.5 shrink-0 text-[var(--mkt-text-muted)] transition-transform",
                            itemOpen && "rotate-180",
                          )}
                          aria-hidden
                        />
                      </button>
                      {itemOpen ? (
                        <p className="ml-5 border-l-2 border-[var(--mkt-brand)] px-5 pb-4 text-sm leading-relaxed text-[var(--mkt-text-muted)]">
                          <span className="block pl-3">{item.description}</span>
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
