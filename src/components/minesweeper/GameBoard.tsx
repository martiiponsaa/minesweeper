
'use client';

import React, { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import CellComponent from './Cell';
import type { BoardState, CellState, GameStatus } from '@/lib/minesweeper';
import {
  createInitialBoard,
  placeMines,
  revealCell,
  toggleFlag,
  checkWinCondition,
  getRemainingMines,
  calculateAdjacentMines, 
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
import type { Timestamp } from 'firebase/firestore';


export type InternalGameStatus = 'won' | 'lost' | 'quit';


interface GameBoardProps {
  difficultyKey: DifficultyKey;
  onGameEnd?: (status: InternalGameStatus, time: number, boardState: string) => void; 
  isGuest: boolean;
  initialBoardState?: string; 
  initialTimeElapsed?: number; 
}

export interface GameBoardRef {
  getCurrentBoardState: () => string;
  getCurrentTimeElapsed: () => number;
  resetBoardToInitial: () => void; 
  calculateTimeFromStart: (startTime: Timestamp) => number;
}


const GameBoard = forwardRef<GameBoardRef, GameBoardProps>(({ 
  difficultyKey, 
  onGameEnd, 
  isGuest,
  initialBoardState,
  initialTimeElapsed = 0 
}, ref) => {
  const [difficulty, setDifficulty] = useState<DifficultySetting>(DIFFICULTY_LEVELS[difficultyKey]);
  
  const [board, setBoard] = useState<BoardState>(() => {
    if (initialBoardState && !["INITIAL_BOARD_STATE", "QUIT_FOR_NEW_GAME", "QUIT_ON_RESTART", "QUIT_ON_DIFFICULTY_CHANGE", "QUIT_STATE_UNKNOWN", "AUTO_QUIT_MULTIPLE_IN_PROGRESS"].includes(initialBoardState)) {
      try {
        const parsedBoard = JSON.parse(initialBoardState) as BoardState;
        if (Array.isArray(parsedBoard) && parsedBoard.length > 0 && Array.isArray(parsedBoard[0])) {
            if (parsedBoard.every(row => Array.isArray(row) && row.every(cell => typeof cell.isRevealed === 'boolean'))) {
                return calculateAdjacentMines(parsedBoard, parsedBoard.length, parsedBoard[0].length);
            }
        }
        console.warn("Invalid initialBoardState structure, falling back to new board.");
      } catch (e) {
        console.error("Error parsing initialBoardState, falling back to new board:", e);
      }
    }
    return createInitialBoard(DIFFICULTY_LEVELS[difficultyKey].rows, DIFFICULTY_LEVELS[difficultyKey].cols);
  });

  const [gameStatus, setGameStatus] = useState<GameStatus>(initialBoardState ? 'playing' : 'ready');
  const [minesRemaining, setMinesRemaining] = useState<number>(() => {
      const currentDifficultySettings = DIFFICULTY_LEVELS[difficultyKey];
      return getRemainingMines(board, currentDifficultySettings.mines);
  });
  const [timeElapsed, setTimeElapsed] = useState<number>(initialTimeElapsed);
  const [firstClick, setFirstClick] = useState<boolean>(!initialBoardState || ["INITIAL_BOARD_STATE", "QUIT_FOR_NEW_GAME", "QUIT_ON_RESTART", "QUIT_ON_DIFFICULTY_CHANGE", "QUIT_STATE_UNKNOWN", "AUTO_QUIT_MULTIPLE_IN_PROGRESS"].includes(initialBoardState));
  const [revealedCellsCount, setRevealedCellsCount] = useState<number>(() => {
    let count = 0;
    board.forEach(row => row.forEach(cell => {
        if (cell.isRevealed && !cell.isMine) count++;
    }));
    return count;
  });

  const [showDialog, setShowDialog] = useState<boolean>(false);
  const [dialogMessage, setDialogMessage] = useState<{title: string, description: string, icon?: React.ReactNode}>({title: '', description: '', icon: undefined});


  const resetGameInternals = useCallback((newDifficultyKey: DifficultyKey, keepDialog = false) => {
    const newDifficultySettings = DIFFICULTY_LEVELS[newDifficultyKey];
    setDifficulty(newDifficultySettings);
    setBoard(createInitialBoard(newDifficultySettings.rows, newDifficultySettings.cols));
    setGameStatus('ready');
    setMinesRemaining(newDifficultySettings.mines);
    setTimeElapsed(0); // Reset time on internal reset
    setFirstClick(true);
    setRevealedCellsCount(0);
    if (!keepDialog) {
      setShowDialog(false);
    }
  }, []);


  useEffect(() => {
    const newDifficultySettings = DIFFICULTY_LEVELS[difficultyKey];
    setDifficulty(newDifficultySettings);

    if (initialBoardState && !["INITIAL_BOARD_STATE", "QUIT_FOR_NEW_GAME", "QUIT_ON_RESTART", "QUIT_ON_DIFFICULTY_CHANGE", "QUIT_STATE_UNKNOWN", "AUTO_QUIT_MULTIPLE_IN_PROGRESS"].includes(initialBoardState)) {
        try {
            const parsedBoardInput = JSON.parse(initialBoardState) as BoardState;
            if (Array.isArray(parsedBoardInput) && 
                parsedBoardInput.length === newDifficultySettings.rows && 
                parsedBoardInput[0].length === newDifficultySettings.cols &&
                parsedBoardInput.every(row => Array.isArray(row) && row.every(cell => typeof cell.isRevealed === 'boolean'))) {

                const boardWithCalculatedMines = calculateAdjacentMines(parsedBoardInput, newDifficultySettings.rows, newDifficultySettings.cols);
                setBoard(boardWithCalculatedMines);
                setMinesRemaining(getRemainingMines(boardWithCalculatedMines, newDifficultySettings.mines));
                setGameStatus('playing'); 
                setFirstClick(false); 
                setTimeElapsed(initialTimeElapsed || 0);

                let revealed = 0;
                boardWithCalculatedMines.forEach(row => row.forEach(cell => {
                    if (cell.isRevealed && !cell.isMine) revealed++;
                }));
                setRevealedCellsCount(revealed);
            } else {
                 resetGameInternals(difficultyKey);
            }
        } catch (e) {
            console.error("Error processing initialBoardState on difficulty/prop change:", e);
            resetGameInternals(difficultyKey);
        }
    } else {
        resetGameInternals(difficultyKey);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficultyKey, initialBoardState]); 

  useEffect(() => {
    setTimeElapsed(initialTimeElapsed);
  }, [initialTimeElapsed]);

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
    let currentRevealedCount = 0;
    newBoard.forEach(row => row.forEach(cell => {
      if (cell.isRevealed && !cell.isMine) currentRevealedCount++;
    }));
    setRevealedCellsCount(currentRevealedCount);


    if (gameOver) {
      setGameStatus('lost');
      setDialogMessage({ title: 'Game Over!', description: 'You hit a mine. Better luck next time!', icon: <Frown className="h-6 w-6 text-red-500" /> });
      setShowDialog(true);
      onGameEnd?.('lost', timeElapsed, JSON.stringify(newBoard));
    } else {
      if (checkWinCondition(newBoard, difficulty.rows, difficulty.cols, difficulty.mines)) {
        setGameStatus('won');
        setDialogMessage({ title: 'Congratulations!', description: 'You cleared the board!', icon: <PartyPopper className="h-6 w-6 text-yellow-500" /> });
        setShowDialog(true);
        onGameEnd?.('won', timeElapsed, JSON.stringify(newBoard));
      }
    }
  };

  const handleCellContextMenu = (e: React.MouseEvent, x: number, y: number) => {
    e.preventDefault();
    if (gameStatus === 'lost' || gameStatus === 'won' || board[y][x].isRevealed) {
      return;
    }
    
    let currentBoard = board; 
    if (gameStatus === 'ready' && firstClick) {
        currentBoard = placeMines(board, difficulty.rows, difficulty.cols, difficulty.mines, x, y);
        setFirstClick(false);   
        setGameStatus('playing'); 
    } else if (gameStatus === 'ready' && !firstClick) { 
        setGameStatus('playing');
    }

    const newBoardAfterFlag = toggleFlag(currentBoard, x, y);
    setBoard(newBoardAfterFlag);
    setMinesRemaining(getRemainingMines(newBoardAfterFlag, difficulty.mines));
  };


  const getGameStatusIcon = () => {
    if (gameStatus === 'won') return <PartyPopper className="h-8 w-8 text-yellow-500" />;
    if (gameStatus === 'lost') return <Frown className="h-8 w-8 text-red-500" />;
    return <Smile className="h-8 w-8 text-foreground" />;
  };
  
  const getGridStyle = () => {
    let cellSize = "minmax(20px, 1fr)";
    if (difficulty.cols > 20) cellSize = "minmax(18px, 1fr)";
    if (difficulty.cols > 25) cellSize = "minmax(16px, 1fr)";

    return {
      gridTemplateColumns: `repeat(${difficulty.cols}, ${cellSize})`,
      maxWidth: `${difficulty.cols * 40}px`, 
    };
  };

  useImperativeHandle(ref, () => ({
    getCurrentBoardState: () => JSON.stringify(board),
    getCurrentTimeElapsed: () => timeElapsed,
    resetBoardToInitial: () => { 
        resetGameInternals(difficultyKey);
        setTimeElapsed(0); // Ensure timer is reset on explicit board reset
    },
    calculateTimeFromStart: (startTime: Timestamp) => {
        const now = Math.floor(Date.now() / 1000); // Current time in seconds
        const startSeconds = startTime.seconds;
        return Math.max(0, now - startSeconds);
    }
  }));


  return (
    <div className="flex flex-col items-center w-full p-2 sm:p-4">
      <div className="flex justify-between items-center w-full max-w-3xl mb-4 p-3 bg-card rounded-lg shadow">
        <div className="flex items-center text-lg font-semibold">
          <FlagIcon className="mr-2 h-5 w-5 text-red-500" />
          <span className="text-foreground">{String(minesRemaining).padStart(3, '0')}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => resetGameInternals(difficultyKey)} className="hover:bg-accent">
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
              key={`${y}-${x}-${gameStatus}-${cell.isRevealed}-${cell.isFlagged}-${cell.isMine}-${cell.adjacentMines}`} 
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
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Close
            </Button>
            <AlertDialogAction onClick={() => {
              // AlertDialogAction implicitly closes the dialog.
              // Then reset the game. resetGameInternals will also attempt to close dialog (harmless).
              resetGameInternals(difficultyKey);
            }}>
              Play Again
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
});

GameBoard.displayName = 'GameBoard';
export default GameBoard;

    
