"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { MenuCategory } from "@/types/menu";

interface CategoryPillNavProps {
  categories: MenuCategory[];
  activeCategory: string;
  onChange: (slug: string) => void;
}

export function CategoryPillNav({
  categories,
  activeCategory,
  onChange,
}: CategoryPillNavProps): React.ReactElement {
  return (
    <div className="pos-scrollbar relative mb-4 flex gap-2 overflow-x-auto pb-1">
      {categories.map((category) => {
        const active = activeCategory === category.slug;

        return (
          <button
            key={category.slug}
            className={cn(
              "relative min-h-category-tab shrink-0 rounded-full px-4 py-2.5 text-sm font-semibold tracking-wide transition-colors sm:px-5",
              active ? "text-white" : "text-zinc-400 hover:text-zinc-200",
            )}
            type="button"
            onClick={() => onChange(category.slug)}
          >
            {active ? (
              <motion.span
                layoutId="pos-category-pill"
                className="absolute inset-0 rounded-full bg-gradient-to-r from-rose-500 to-violet-500 shadow-[0_0_20px_rgba(244,63,94,0.35)]"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            ) : (
              <span className="absolute inset-0 rounded-full bg-white/5 ring-1 ring-inset ring-white/10" />
            )}
            <span className="relative z-10">{category.label}</span>
          </button>
        );
      })}
    </div>
  );
}
