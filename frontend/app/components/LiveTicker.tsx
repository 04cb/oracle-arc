"use client";

import { useEffect, useState } from "react";

type Item = {
  id: string;
  text: string;
  hint?: string;
};

type Props = {
  items: Item[];
};

export function LiveTicker({ items }: Props) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % items.length), 4000);
    return () => clearInterval(t);
  }, [items.length]);

  if (items.length === 0) return null;
  const current = items[idx];

  return (
    <div
      className="flex items-center gap-3 border-y border-zinc-800 bg-zinc-950 px-4 py-2 overflow-hidden"
      aria-live="polite"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
      <span className="text-[10px] uppercase tracking-[0.3em] text-emerald-300 shrink-0">
        live
      </span>
      <div className="text-xs text-zinc-300 truncate flex-1">
        {current.text}
      </div>
      {current.hint && (
        <span className="text-[10px] text-zinc-500 shrink-0">
          {current.hint}
        </span>
      )}
    </div>
  );
}
