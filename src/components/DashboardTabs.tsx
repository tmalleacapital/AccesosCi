"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Tab {
  id: string;
  label: string;
  badge?: number;
  content: ReactNode;
}

export function DashboardTabs({
  tabs,
  tabInicial,
  size = "md",
}: {
  tabs: Tab[];
  tabInicial?: string;
  size?: "md" | "sm";
}) {
  const [activo, setActivo] = useState(tabInicial ?? tabs[0]?.id);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null;
    if (e.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
    else if (e.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") nextIndex = 0;
    else if (e.key === "End") nextIndex = tabs.length - 1;
    if (nextIndex === null) return;
    e.preventDefault();
    const next = tabs[nextIndex];
    setActivo(next.id);
    tabRefs.current[next.id]?.focus();
  }

  return (
    <div>
      <div role="tablist" aria-orientation="horizontal" className="flex flex-wrap gap-1 border-b border-border">
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={(el) => {
              tabRefs.current[tab.id] = el;
            }}
            type="button"
            role="tab"
            aria-selected={activo === tab.id}
            tabIndex={activo === tab.id ? 0 : -1}
            onClick={() => setActivo(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={cn(
              "flex items-center gap-2 border-b-2 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
              size === "md" ? "px-4 py-2 text-sm" : "px-3 py-1.5 text-xs",
              activo === tab.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
            {typeof tab.badge === "number" && tab.badge > 0 && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-semibold text-foreground">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      <div role="tabpanel" className={size === "md" ? "pt-6" : "pt-4"}>
        {tabs.find((t) => t.id === activo)?.content}
      </div>
    </div>
  );
}
