
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import CellComponent from './Cell';
import type { BoardState, CellState, GameStatus } from '@/lib/minesweeper';
import {
  createInitialBoard,
  placeMines,
  revealCell,
  toggleFlag,
  checkWinCondition,
  getRemainingMines,
} from '@/lib/minesweeper';
import { DIFFICULTY_LEVELS, type DifficultyKey, type DifficultySetting } from '@/config/minesweeperSettings';
import { Button } from '@/components/ui/button';
import { Smile, Frown, PartyPopper, Timer, Flag as FlagIcon } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"


interface GameBoardProps {
  difficultyKey: DifficultyKey;
  onGameEnd?: (status: 'won' | 'lost', time: number) => void; // For saving stats later
  isGuest: boolean;
}

const GameBoard: React.FC<GameBoardProps> = ({ difficultyKey, onGameEnd, isGuest }) => {
  const [difficulty, setDifficulty] = useState<DifficultySetting>(DIFFICULTY_LEVELS[difficultyKey]);
  const [board, setBoard] = useState<BoardState>(() => createInitialBoard(difficulty.rows, difficulty.cols));
  const [gameStatus, setGameStatus] = useState<GameStatus>('ready');
  const [minesRemaining, setMinesRemaining] = useState<number>(difficulty.mines);
  const [timeElapsed, setTimeElapsed] = useState<number>(0);
  const [firstClick, setFirstClick] = useState<boolean>(true);
  const [revealedCellsCount, setRevealedCellsCount] = useState<number>(0);
  const [showDialog, setShowDialog] = useState<boolean>(false);
  const [dialogMessage, setDialogMessage] = useState<{title: string, description: string, icon?: React.ReactNode}>({title: '', description: ''});


  const resetGame = useCallback(() => {
    const newDifficulty = DIFFICULTY_LEVELS[difficultyKey];
    setDifficulty(newDifficulty);
    setBoard(createInitialBoard(newDifficulty.rows, newDifficulty.cols));
    setGameStatus('ready');
    setMinesRemaining(newDifficulty.mines);
    setTimeElapsed(0);
    setFirstClick(true);
    setRevealedCellsCount(0);
    setShowDialog(false);
  }, [difficultyKey]);

  useEffect(() => {
    resetGame();
  }, [difficultyKey, resetGame]);


  useEffect(() => {
    let timerId: NodeJS.Timeout | undefined;
    if (gameStatus === 'playing') {
      timerId = setInterval(() => {
        setTimeElapsed((prevTime) => prevTime + 1);
      }, 1000);
    }
    return () => clearInterval(timerId);
  }, [gameStatus]);

  const handleCellClick = (x: number, y: number) => {
    if (gameStatus === 'lost' || gameStatus === 'won' || board[y][x].isFlagged) {
      return;
    }

    let currentBoard = board;
    if (firstClick) {
      currentBoard = placeMines(board, difficulty.rows, difficulty.cols, difficulty.mines, x, y);
      setFirstClick(false);
      setGameStatus('playing');
    }

    const { newBoard, gameOver, cellsRevealedCount: newlyRevealed } = revealCell(currentBoard, difficulty.rows, difficulty.cols, x, y);
    setBoard(newBoard);
    setRevealedCellsCount(prev => prev + newlyRevealed);


    if (gameOver) {
      setGameStatus('lost');
      setDialogMessage({ title: 'Game Over!', description: 'You hit a mine. Better luck next time!', icon: <Frown className="h-6 w-6 text-red-500" /> });
      setShowDialog(true);
      onGameEnd?.('lost', timeElapsed);
    } else {
      if (checkWinCondition(newBoard, difficulty.rows, difficulty.cols, difficulty.mines)) {
        setGameStatus('won');
        setDialogMessage({ title: 'Congratulations!', description: 'You cleared the board!', icon: <PartyPopper className="h-6 w-6 text-yellow-500" /> });
        setShowDialog(true);
        onGameEnd?.('won', timeElapsed);
      }
    }
  };

  const handleCellContextMenu = (e: React.MouseEvent, x: number, y: number) => {
    e.preventDefault();
    if (gameStatus === 'lost' || gameStatus === 'won' || board[y][x].isRevealed) {
      return;
    }
    if (gameStatus === 'ready') {
        setGameStatus('playing'); // Start timer on first flag if game hasn't started
    }

    const newBoard = toggleFlag(board, x, y);
    setBoard(newBoard);
    setMinesRemaining(getRemainingMines(newBoard, difficulty.mines));
  };

  const getGameStatusIcon = () => {
    if (gameStatus === 'won') return <PartyPopper className="h-8 w-8 text-yellow-500" />;
    if (gameStatus === 'lost') return <Frown className="h-8 w-8 text-red-500" />;
    return <Smile className="h-8 w-8 text-foreground" />;
  };

  const gridColsClass = `grid-cols-${difficulty.cols}`;
  
  // Dynamic grid styling based on number of columns
  const getGridStyle = () => {
    // For smaller screens, we might want to limit the max width of cells
    // This is a basic example, more sophisticated logic might be needed
    let cellSize = "minmax(20px, 1fr)";
    if (difficulty.cols > 20) cellSize = "minmax(18px, 1fr)";
    if (difficulty.cols > 25) cellSize = "minmax(16px, 1fr)";


    return {
      gridTemplateColumns: `repeat(${difficulty.cols}, ${cellSize})`,
      maxWidth: `${difficulty.cols * 40}px`, // Max width to prevent huge boards on large screens
    };
  };


  return (
    <div className="flex flex-col items-center w-full p-2 sm:p-4">
      <div className="flex justify-between items-center w-full max-w-3xl mb-4 p-3 bg-card rounded-lg shadow">
        <div className="flex items-center text-lg font-semibold">
          <FlagIcon className="mr-2 h-5 w-5 text-red-500" />
          <span className="text-foreground">{String(minesRemaining).padStart(3, '0')}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={resetGame} className="hover:bg-accent">
          {getGameStatusIcon()}
        </Button>
        <div className="flex items-center text-lg font-semibold">
          <Timer className="mr-2 h-5 w-5 text-blue-500" />
          <span className="text-foreground">{String(timeElapsed).padStart(3, '0')}</span>
        </div>
      </div>

      <div
        className="grid gap-0.5 bg-border p-1 rounded-md shadow-md overflow-auto"
        style={getGridStyle()}
        role="grid"
        aria-label={`Minesweeper board, ${difficulty.rows} rows by ${difficulty.cols} columns`}
      >
        {board.map((row, y) =>
          row.map((cell, x) => (
            <CellComponent
              key={`${y}-${x}`}
              cell={cell}
              onClick={() => handleCellClick(x, y)}
              onContextMenu={(e) => handleCellContextMenu(e, x, y)}
            />
          ))
        )}
      </div>
      
      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center">
                {dialogMessage.icon && <span className="mr-2">{dialogMessage.icon}</span>}
                {dialogMessage.title}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {dialogMessage.description}
              {gameStatus === 'won' && <span className="block mt-2">Your time: {timeElapsed} seconds.</span>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={resetGame}>Play Again</AlertDialogAction>
            {/* <AlertDialogCancel onClick={() => setShowDialog(false)}>Close</AlertDialogCancel> */}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
};

export default GameBoard;

