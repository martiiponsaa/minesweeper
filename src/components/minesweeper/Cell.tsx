
'use client';

import React from 'react';
import type { CellState } from '@/lib/minesweeper';
import { Flag, Bomb } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CellProps {
  cell: CellState;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

const getNumberColorClass = (numMines: number): string => {
  switch (numMines) {
    case 1: return 'text-blue-600';
    case 2: return 'text-green-600';
    case 3: return 'text-red-600';
    case 4: return 'text-blue-800'; // Darker blue
    case 5: return 'text-yellow-700'; // Brownish
    case 6: return 'text-cyan-600';
    case 7: return 'text-black';
    case 8: return 'text-gray-500';
    default: return '';
  }
};

const CellComponent: React.FC<CellProps> = ({ cell, onClick, onContextMenu }) => {
  const renderContent = () => {
    if (cell.isRevealed) {
      if (cell.isMine) {
        return <Bomb className={cn("h-4 w-4 sm:h-5 sm:w-5", cell.exploded ? "text-red-700" : "text-foreground")} />;
      }
      if (cell.adjacentMines > 0) {
        return <span className={cn("font-bold", getNumberColorClass(cell.adjacentMines))}>{cell.adjacentMines}</span>;
      }
      return null; // Empty revealed cell
    }
    if (cell.isFlagged) {
      return <Flag className="h-4 w-4 sm:h-5 sm:w-5 text-red-500" />;
    }
    return null; // Hidden cell
  };

  return (
    <button
      type="button"
      onClick={onClick}
      onContextMenu={onContextMenu}
      disabled={cell.isRevealed && !cell.isMine} // Allow clicking revealed mine for visual effect if needed
      className={cn(
        'w-full aspect-square flex items-center justify-center border border-border/50 transition-colors duration-100 text-xs sm:text-sm md:text-base relative', // Added relative for z-index on ring
        {
          'bg-muted/50 cursor-default': cell.isRevealed && !cell.isMine && !cell.exploded,
          'bg-muted/70': cell.isRevealed && cell.isMine && !cell.exploded,
          'bg-red-500/50': cell.isRevealed && cell.isMine && cell.exploded,
          'bg-muted-foreground/20 hover:bg-muted-foreground/30 cursor-pointer': !cell.isRevealed && !cell.isFlagged,
          'bg-yellow-500/20 hover:bg-yellow-500/30': cell.isFlagged && !cell.isRevealed,
          'ring-2 ring-inset z-10': cell.isReplayHighlight,
          'ring-green-500': cell.isReplayHighlight && !cell.isReplayHighlightBad,
          'ring-red-500': cell.isReplayHighlight && cell.isReplayHighlightBad,
        }
      )}
      aria-label={`Cell at ${cell.x}, ${cell.y}. Status: ${cell.isRevealed ? (cell.isMine ? 'Mine' : `Revealed, ${cell.adjacentMines} mines`) : (cell.isFlagged ? 'Flagged' : 'Hidden')}`}
    >
      {renderContent()}
    </button>
  );
};

export default CellComponent;

