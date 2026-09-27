"use client";

import { motion } from "framer-motion";
import { formatAud } from "@/lib/format";
import { getDisplayPrice } from "@/lib/menu";
import { cn } from "@/lib/utils";
import type { MenuItem } from "@/types/menu";

interface ProductCardProps {
  item: MenuItem;
  inCartQty: number;
  onSelect: (item: MenuItem) => void;
}

export function ProductCard({
  item,
  inCartQty,
  onSelect,
}: ProductCardProps): React.ReactElement {
  return (
    <motion.button
      layout
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl text-left",
        "border border-white/10 bg-white/[0.04] shadow-glass backdrop-blur-sm",
        "transition-colors hover:border-white/20 hover:bg-white/[0.07]",
      )}
      type="button"
      onClick={() => onSelect(item)}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-800/80">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={item.imageAlt || item.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
            src={item.imageUrl}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900 text-4xl opacity-40">
            ·
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-zinc-950/90 via-zinc-950/40 to-transparent p-3 pt-10">
          <p className="font-mono text-sm font-semibold tabular-nums text-white">
            {formatAud(getDisplayPrice(item))}
          </p>
        </div>

        {inCartQty > 0 ? (
          <span className="absolute right-2.5 top-2.5 flex h-7 min-w-7 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-violet-500 px-1.5 text-xs font-bold text-white shadow-lg">
            {inCartQty}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="text-sm font-semibold leading-snug text-zinc-100">
          {item.name}
        </p>
        {item.description ? (
          <p className="line-clamp-2 text-xs leading-relaxed text-zinc-400">
            {item.description}
          </p>
        ) : null}
      </div>
    </motion.button>
  );
}
