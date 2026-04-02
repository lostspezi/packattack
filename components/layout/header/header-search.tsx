"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { Search, X } from "lucide-react";

interface HeaderSearchProps {
  lang: string;
  dict: Record<string, string>;
}

export function HeaderSearch({ lang, dict }: HeaderSearchProps) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function handleOpen() {
    setExpanded(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function handleClose() {
    setExpanded(false);
    setQuery("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed) {
      router.push(`/${lang}/search?q=${encodeURIComponent(trimmed)}`);
      handleClose();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") handleClose();
  }

  return (
    <div className="relative hidden md:flex items-center">
      <AnimatePresence mode="wait">
        {expanded ? (
          <motion.form
            key="search-input"
            onSubmit={handleSubmit}
            initial={{ width: 40, opacity: 0.5 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 40, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="flex items-center overflow-hidden rounded-lg border border-white/10 bg-white/5"
          >
            <Search className="ml-3 h-4 w-4 shrink-0 text-text-muted" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => { if (!query) handleClose(); }}
              placeholder={dict["search_placeholder"] ?? "Suchen..."}
              className="flex-1 bg-transparent px-2 py-1.5 text-sm text-text-primary placeholder:text-text-muted outline-none"
            />
            <button
              type="button"
              onClick={handleClose}
              className="mr-1 rounded p-1 text-text-muted transition-colors hover:text-text-primary"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.form>
        ) : (
          <motion.button
            key="search-icon"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={handleOpen}
            className="rounded-lg p-2 text-text-muted transition-colors hover:bg-white/5 hover:text-text-primary"
            aria-label={dict["search"] ?? "Suchen"}
          >
            <Search className="h-4 w-4" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
