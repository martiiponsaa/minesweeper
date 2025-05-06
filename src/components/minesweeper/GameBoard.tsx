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
    if (initialBoardState) {
      try {
        const parsedBoard = JSON.parse(initialBoardState) as BoardState;
        if (Array.isArray(parsedBoard) &amp;&amp; parsedBoard.length &gt; 0 &amp;&amp; Array.isArray(parsedBoard[0])) {
            if (parsedBoard.every(row =&gt; Array.isArray(row) &amp;&amp; row.every(cell =&gt; typeof cell.isRevealed === 'boolean'))) {
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
  const [firstClick, setFirstClick] = useState<boolean>(!initialBoardState);
  const [revealedCellsCount, setRevealedCellsCount] = useState<number>(() => {
    let count = 0;
    board.forEach(row =&gt; row.forEach(cell =&gt; {
        if (cell.isRevealed &amp;&amp; !cell.isMine) count++;
    }));
    return count;
  });

  const [showDialog, setShowDialog] = useState<boolean>(false);
  const [dialogMessage, setDialogMessage] = useState&lt;{title: string, description: string, icon?: React.ReactNode}&gt;({title: '', description: '', icon?: React.ReactNode});


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

    if (initialBoardState) {
        try {
            const parsedBoardInput = JSON.parse(initialBoardState) as BoardState;
            if (Array.isArray(parsedBoardInput) &amp;&amp; 
                parsedBoardInput.length === newDifficultySettings.rows &amp;&amp; 
                parsedBoardInput[0].length === newDifficultySettings.cols &amp;&amp;
                parsedBoardInput.every(row =&gt; Array.isArray(row) &amp;&amp; row.every(cell =&gt; typeof cell.isRevealed === 'boolean'))) {

                const boardWithCalculatedMines = calculateAdjacentMines(parsedBoardInput, newDifficultySettings.rows, newDifficultySettings.cols);
                setBoard(boardWithCalculatedMines);
                setMinesRemaining(getRemainingMines(boardWithCalculatedMines, newDifficultySettings.mines));
                setGameStatus('playing'); 
                setFirstClick(false); 
                setTimeElapsed(initialTimeElapsed || 0);

                let revealed = 0;
                boardWithCalculatedMines.forEach(row =&gt; row.forEach(cell =&gt; {
                    if (cell.isRevealed &amp;&amp; !cell.isMine) revealed++;
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
        setTimeElapsed((prevTime) =&gt; prevTime + 1);
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
    newBoard.forEach(row =&gt; row.forEach(cell =&gt; {
      if (cell.isRevealed &amp;&amp; !cell.isMine) currentRevealedCount++;
    }));
    setRevealedCellsCount(currentRevealedCount);


    if (gameOver) {
      setGameStatus('lost');
      setDialogMessage({ title: 'Game Over!', description: 'You hit a mine. Better luck next time!', icon: &lt;Frown className="h-6 w-6 text-red-500" /&gt; });
      setShowDialog(true);
      onGameEnd?.('lost', timeElapsed, JSON.stringify(newBoard));
    } else {
      if (checkWinCondition(newBoard, difficulty.rows, difficulty.cols, difficulty.mines)) {
        setGameStatus('won');
        setDialogMessage({ title: 'Congratulations!', description: 'You cleared the board!', icon: &lt;PartyPopper className="h-6 w-6 text-yellow-500" /&gt; });
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
    if (gameStatus === 'ready' &amp;&amp; firstClick) {
        currentBoard = placeMines(board, difficulty.rows, difficulty.cols, difficulty.mines, x, y);
        setFirstClick(false);   
        setGameStatus('playing'); 
    } else if (gameStatus === 'ready' &amp;&amp; !firstClick) { 
        setGameStatus('playing');
    }

    const newBoardAfterFlag = toggleFlag(currentBoard, x, y);
    setBoard(newBoardAfterFlag);
    setMinesRemaining(getRemainingMines(newBoardAfterFlag, difficulty.mines));
  };


  const getGameStatusIcon = () => {
    if (gameStatus === 'won') return &lt;PartyPopper className="h-8 w-8 text-yellow-500" /&gt;;
    if (gameStatus === 'lost') return &lt;Frown className="h-8 w-8 text-red-500" /&gt;;
    return &lt;Smile className="h-8 w-8 text-foreground" /&gt;;
  };
  
  const getGridStyle = () => {
    let cellSize = "minmax(20px, 1fr)";
    if (difficulty.cols &gt; 20) cellSize = "minmax(18px, 1fr)";
    if (difficulty.cols &gt; 25) cellSize = "minmax(16px, 1fr)";

    return {
      gridTemplateColumns: `repeat(${difficulty.cols}, ${cellSize})`,
      maxWidth: `${difficulty.cols * 40}px`, 
    };
  };

  useImperativeHandle(ref, () =&gt; ({
    getCurrentBoardState: () =&gt; JSON.stringify(board),
    getCurrentTimeElapsed: () =&gt; timeElapsed,
    resetBoardToInitial: () =&gt; { 
        resetGameInternals(difficultyKey);
        setTimeElapsed(0); // Ensure timer is reset on explicit board reset
    },
    calculateTimeFromStart: (startTime: Timestamp) =&gt; {
        const now = Math.floor(Date.now() / 1000); // Current time in seconds
        const startSeconds = startTime.seconds;
        return Math.max(0, now - startSeconds);
    }
  }));


  return (
    &lt;div className="flex flex-col items-center w-full p-2 sm:p-4"&gt;
      &lt;div className="flex justify-between items-center w-full max-w-3xl mb-4 p-3 bg-card rounded-lg shadow"&gt;
        &lt;div className="flex items-center text-lg font-semibold"&gt;
          &lt;FlagIcon className="mr-2 h-5 w-5 text-red-500" /&gt;
          &lt;span className="text-foreground"&gt;{String(minesRemaining).padStart(3, '0')}&lt;/span&gt;
        &lt;/div&gt;
        &lt;Button variant="ghost" size="icon" onClick={() =&gt; resetGameInternals(difficultyKey)} className="hover:bg-accent"&gt;
          {getGameStatusIcon()}
        &lt;/Button&gt;
        &lt;div className="flex items-center text-lg font-semibold"&gt;
          &lt;Timer className="mr-2 h-5 w-5 text-blue-500" /&gt;
          &lt;span className="text-foreground"&gt;{String(timeElapsed).padStart(3, '0')}&lt;/span&gt;
        &lt;/div&gt;
      &lt;/div&gt;

      &lt;div
        className="grid gap-0.5 bg-border p-1 rounded-md shadow-md overflow-auto"
        style={getGridStyle()}
        role="grid"
        aria-label={`Minesweeper board, ${difficulty.rows} rows by ${difficulty.cols} columns`}
      &gt;
        {board.map((row, y) =&gt;
          row.map((cell, x) =&gt; (
            &lt;CellComponent
              key={`${y}-${x}-${gameStatus}-${cell.isRevealed}-${cell.isFlagged}-${cell.isMine}-${cell.adjacentMines}`} 
              cell={cell}
              onClick={() =&gt; handleCellClick(x, y)}
              onContextMenu={(e) =&gt; handleCellContextMenu(e, x, y)}
            /&gt;
          ))
        )}
      &lt;/div&gt;
      
      &lt;AlertDialog open={showDialog} onOpenChange={setShowDialog}&gt;
        &lt;AlertDialogContent&gt;
          &lt;AlertDialogHeader&gt;
            &lt;AlertDialogTitle className="flex items-center"&gt;
                {dialogMessage.icon &amp;&amp; &lt;span className="mr-2"&gt;{dialogMessage.icon}&lt;/span&gt;}
                {dialogMessage.title}
            &lt;/AlertDialogTitle&gt;
            &lt;AlertDialogDescription&gt;
              {dialogMessage.description}
              {gameStatus === 'won' &amp;&amp; &lt;span className="block mt-2"&gt;Your time: {timeElapsed} seconds.&lt;/span&gt;}
            &lt;/AlertDialogDescription&gt;
          &lt;/AlertDialogHeader&gt;
          &lt;AlertDialogFooter&gt;
            &lt;AlertDialogAction onClick={() =&gt; resetGameInternals(difficultyKey, true)}&gt;Play Again&lt;/AlertDialogAction&gt;
          &lt;/AlertDialogFooter&gt;
        &lt;/AlertDialogContent&gt;
      &lt;/AlertDialog&gt;

    &lt;/div&gt;
  );
});

GameBoard.displayName = 'GameBoard';
export default GameBoard;

