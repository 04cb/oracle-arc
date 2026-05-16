"use client";

import { useState } from "react";

type Props = {
  url: string;
  text: string;
};

export function ShareBar({ url, text }: Props) {
  const [copied, setCopied] = useState(false);
  const tweet = encodeURIComponent(`${text}\n\n${url}`);
  const xHref = `https://twitter.com/intent/tweet?text=${tweet}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="flex items-center gap-2">
      <a
        href={xHref}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs px-3 py-1.5 rounded border border-zinc-700 hover:border-zinc-500 text-zinc-300"
        title="Share on X"
      >
        Share on X
      </a>
      <button
        onClick={copy}
        className="text-xs px-3 py-1.5 rounded border border-zinc-700 hover:border-zinc-500 text-zinc-300"
        title="Copy link"
      >
        {copied ? "Copied!" : "Copy link"}
      </button>
    </div>
  );
}
