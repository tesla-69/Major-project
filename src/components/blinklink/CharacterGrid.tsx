"use client";

import type { FC } from 'react';
import { cn } from '@/lib/utils';
import { CHAR_GRID } from '@/lib/constants';

type CharacterGridProps = {
  highlightedCol: number | null;
  highlightedRow: number | null;
};

export const CharacterGrid: FC<CharacterGridProps> = ({
  highlightedCol,
  highlightedRow,
}) => {
  return (
    <div className="flex flex-col gap-1.5 p-4 bg-card rounded-xl shadow-lg border">
      {CHAR_GRID.map((row, rowIndex) => (
        <div key={rowIndex} className="flex gap-1.5">
          {row.map((char, colIndex) => {
            const isColHighlighted = colIndex === highlightedCol;
            const isRowHighlighted = rowIndex === highlightedRow;
            const isHighlighted = isColHighlighted || isRowHighlighted;

            return (
              <div
                key={colIndex}
                className={cn(
                  'flex h-16 w-16 items-center justify-center rounded-lg border text-3xl font-bold transition-colors duration-150',
                  isHighlighted
                    ? 'bg-accent text-accent-foreground scale-110'
                    : 'bg-background',
                  'font-mono'
                )}
              >
                {char}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};
