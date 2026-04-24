"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MegaMenuBattles } from "./mega-menu-battles";
import { MegaMenuPacks } from "./mega-menu-packs";

export type MegaMenuSection = "battles" | "packs" | null;

interface MegaMenuProps {
  activeSection: MegaMenuSection;
  onClose: () => void;
  lang: string;
  dict: Record<string, string>;
  contentLeft: number;
}

export function MegaMenu({
  activeSection,
  onClose,
  lang,
  dict,
  contentLeft,
}: MegaMenuProps) {
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (activeSection) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [activeSection, onClose]);

  return (
    <AnimatePresence>
      {activeSection && (
        <motion.div
          key="mega-menu-panel"
          className="absolute left-0 right-0 top-full z-50 border-b border-white/8"
          style={{ background: "linear-gradient(150deg, var(--color-pa-blue) 10%, var(--color-pa-lila) 50%)" }}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
          aria-label="Navigation submenu"
        >
          <div
            className="py-5 pr-6"
            style={{ paddingLeft: contentLeft }}
          >
            {activeSection === "battles" && (
              <MegaMenuBattles lang={lang} dict={dict} onClose={onClose} />
            )}
            {activeSection === "packs" && (
              <MegaMenuPacks lang={lang} dict={dict} onClose={onClose} />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
