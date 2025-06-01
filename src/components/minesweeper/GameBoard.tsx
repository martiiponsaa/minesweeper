
'use client';

import React, { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import CellComponent from './Cell';
import type { BoardState, CellState, GameStatus } from '@/lib/minesweeper';
import {
  createInitialBoard,
  revealCell,
  toggleFlag,
  checkWinCondition,
  getRemainingMines,
  calculateAdjacentMines,
  placeMinesAndRevealFirstArea,
  findSafeHintCell,
} from '@/lib/minesweeper';
import { DIFFICULTY_LEVELS, type DifficultyKey, type DifficultySetting } from '@/config/minesweeperSettings';
import { Button } from '@/components/ui/button';
import { Smile, Frown, PartyPopper, Timer, Flag as FlagIcon, Eye } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { Timestamp } from 'firebase/firestore';
import { useRouter } from 'next/navigation';

export type InternalGameStatus = 'won' | 'lost' | 'quit';


interface GameBoardProps {
  difficultyKey: DifficultyKey;
  onGameEnd?: (status: InternalGameStatus, time: number, boardState: string) => void;
  isGuest: boolean;
  initialBoardState?: string;
  initialTimeElapsed?: number;
  reviewMode?: boolean;
  activeGameId: string | null;
  onMoveMade?: (moveType: 'reveal' | 'flag' | 'unflag', x: number, y: number) => void;
  onInternalGameStatusChange?: (status: GameStatus) => void; // New prop
}

export interface GameBoardRef {
  getCurrentBoardState: () => string;
  getCurrentTimeElapsed: () => number;
  resetBoardToInitial: () => void;
  calculateTimeFromStart: (startTime: Timestamp) => number;
  requestHint: () => boolean;
}

const nonJsonGameStates = [
  "INITIAL_BOARD_STATE",
  "QUIT_FOR_NEW_GAME",
  "QUIT_ON_RESTART",
  "QUIT_ON_DIFFICULTY_CHANGE",
  "QUIT_STATE_UNKNOWN",
  "AUTO_QUIT_MULTIPLE_IN_PROGRESS",
];


const GameBoard = forwardRef<GameBoardRef, GameBoardProps>(({
  difficultyKey,
  onGameEnd,
  isGuest,
  initialBoardState,
  initialTimeElapsed = 0,
  reviewMode = false,
  activeGameId,
  onMoveMade,
  onInternalGameStatusChange, // Destructure new prop
}, ref) => {
  const router = useRouter();
  const [difficulty, setDifficulty] = useState<DifficultySetting>(DIFFICULTY_LEVELS[difficultyKey]);

  const [board, setBoard] = useState<BoardState>(() => {
    const currentDifficultySettings = DIFFICULTY_LEVELS[difficultyKey];
    if (initialBoardState && !nonJsonGameStates.includes(initialBoardState)) {
      try {
        const parsedBoard = JSON.parse(initialBoardState) as BoardState;
        if (Array.isArray(parsedBoard) && parsedBoard.length > 0 && Array.isArray(parsedBoard[0])) {
            if (parsedBoard.every(row => Array.isArray(row) && row.every(cell => typeof cell.isRevealed === 'boolean'))) {
                if (parsedBoard.length === currentDifficultySettings.rows && parsedBoard[0].length === currentDifficultySettings.cols) {
                    let boardToReturn = parsedBoard;
                    const needsRecalculation = boardToReturn.some(row => row.some(cell => typeof cell.adjacentMines !== 'number'));
                    if (needsRecalculation) {
                        boardToReturn = calculateAdjacentMines(boardToReturn, boardToReturn.length, boardToReturn[0].length);
                    }
                    return boardToReturn;
                } else {
                    console.warn("Parsed initialBoardState dimensions mismatch, falling back to new board.");
                }
            }
        }
        console.warn("Invalid initialBoardState structure, falling back to new board.");
      } catch (e) {
        console.error("Error parsing initialBoardState, falling back to new board:", e);
      }
    }
    return createInitialBoard(currentDifficultySettings.rows, currentDifficultySettings.cols);
  });

  const [gameStatus, setGameStatusInternal] = useState<GameStatus>(() => { // Renamed to avoid conflict
    if (initialBoardState && !nonJsonGameStates.includes(initialBoardState)) {
        try {
            const parsedBoard = JSON.parse(initialBoardState) as BoardState;
            const currentDifficultySettings = DIFFICULTY_LEVELS[difficultyKey];
             if (checkWinCondition(parsedBoard, currentDifficultySettings.rows, currentDifficultySettings.cols, currentDifficultySettings.mines)) {
                return 'won';
            }
            if (parsedBoard.some(row => row.some(cell => cell.isMine && cell.isRevealed && cell.exploded))) {
                return 'lost';
            }
            const isBoardUntouched = parsedBoard.every(row => row.every(cell => !cell.isRevealed && !cell.isFlagged));
            return isBoardUntouched && !reviewMode ? 'ready' : 'playing';
        } catch(e) {
            console.error("Error determining initial game status from board state:", e);
            return reviewMode ? 'playing' : 'ready';
        }
    }
    return reviewMode ? 'playing' : 'ready';
  });

  // Wrapper for setGameStatus to also call onInternalGameStatusChange
  const setGameStatus = (status: GameStatus) => {
    setGameStatusInternal(status);
    onInternalGameStatusChange?.(status);
  };


  const [minesRemaining, setMinesRemaining] = useState<number>(() => {
      const currentDifficultySettings = DIFFICULTY_LEVELS[difficultyKey];
      return getRemainingMines(board, currentDifficultySettings.mines);
  });

  const [timeElapsed, setTimeElapsed] = useState<number>(initialTimeElapsed);
  const [revealedCellsCount, setRevealedCellsCount] = useState<number>(() => {
    let count = 0;
    board.forEach(row => row.forEach(cell => {
        if (cell.isRevealed && !cell.isMine) count++;
    }));
    return count;
  });

  const [showDialog, setShowDialog] = useState<boolean>(false);
  const [dialogMessage, setDialogMessage] = useState<{title: string, description: React.ReactNode, icon?: React.ReactNode}>({title: '', description: '', icon: undefined});

  const [isGameResolvedByLoad, setIsGameResolvedByLoad] = useState(
    initialBoardState && !nonJsonGameStates.includes(initialBoardState) &&
    (gameStatus === 'won' || gameStatus === 'lost') && !reviewMode
  );


  const resetGameInternals = useCallback((newDifficultyKey: DifficultyKey, keepDialog = false) => {
    if (reviewMode) return;
    const newDifficultySettings = DIFFICULTY_LEVELS[newDifficultyKey];
    setDifficulty(newDifficultySettings);
    const freshBoard = createInitialBoard(newDifficultySettings.rows, newDifficultySettings.cols);
    setBoard(freshBoard);
    setGameStatus('ready'); // This will also call onInternalGameStatusChange
    setMinesRemaining(getRemainingMines(freshBoard, newDifficultySettings.mines));
    setTimeElapsed(0);
    setIsGameResolvedByLoad(false);
    setRevealedCellsCount(0);
    if (!keepDialog) {
      setShowDialog(false);
    }
  }, [reviewMode, onInternalGameStatusChange]);


  useEffect(() => {
    const newDifficultySettings = DIFFICULTY_LEVELS[difficultyKey];
    setDifficulty(newDifficultySettings);

    let boardToSet: BoardState;
    let statusToSet: GameStatus = 'ready';
    let resolvedByLoad = false;
    let timeToSet = initialTimeElapsed > 0 ? initialTimeElapsed : 0;

    if (initialBoardState && !nonJsonGameStates.includes(initialBoardState)) {
        try {
            const parsedBoardInput = JSON.parse(initialBoardState) as BoardState;
             if (Array.isArray(parsedBoardInput) && parsedBoardInput.length > 0 && Array.isArray(parsedBoardInput[0]) &&
                parsedBoardInput.length === newDifficultySettings.rows && parsedBoardInput[0].length === newDifficultySettings.cols) {

                boardToSet = parsedBoardInput;
                const needsRecalc = boardToSet.some(row => row.some(c => typeof c.adjacentMines !== 'number'));
                if(needsRecalc){
                    boardToSet = calculateAdjacentMines(boardToSet, newDifficultySettings.rows, newDifficultySettings.cols);
                }

                if (boardToSet.some(row => row.some(cell => cell.isMine && cell.isRevealed && cell.exploded))) {
                    statusToSet = 'lost';
                    resolvedByLoad = !reviewMode;
                } else if (checkWinCondition(boardToSet, newDifficultySettings.rows, newDifficultySettings.cols, newDifficultySettings.mines)) {
                    statusToSet = 'won';
                    resolvedByLoad = !reviewMode;
                } else {
                   const isBoardAltered = parsedBoardInput.some(row => row.some(cell => cell.isRevealed || cell.isFlagged));
                   statusToSet = reviewMode ? 'playing' : (isBoardAltered ? 'playing' : 'ready');
                }
            } else {
                 console.warn("Parsed initialBoardState structure/dimensions mismatch, falling back to new board.");
                 boardToSet = createInitialBoard(newDifficultySettings.rows, newDifficultySettings.cols);
                 statusToSet = reviewMode ? 'playing' : 'ready';
                 timeToSet = 0;
            }
        } catch (e) {
            console.error("Error processing initialBoardState, falling back to new board:", e);
            boardToSet = createInitialBoard(newDifficultySettings.rows, newDifficultySettings.cols);
            statusToSet = reviewMode ? 'playing' : 'ready';
            timeToSet = 0;
        }
    } else {
        boardToSet = createInitialBoard(newDifficultySettings.rows, newDifficultySettings.cols);
        statusToSet = reviewMode ? 'playing' : 'ready';
        timeToSet = 0;
    }

    setBoard(boardToSet);
    setMinesRemaining(getRemainingMines(boardToSet, newDifficultySettings.mines));
    setGameStatus(statusToSet); // This will call onInternalGameStatusChange
    setIsGameResolvedByLoad(resolvedByLoad);

    let currentRevealedCount = 0;
    boardToSet.forEach(row => row.forEach(cell => {
        if(cell.isRevealed && !cell.isMine) currentRevealedCount++;
    }));
    setRevealedCellsCount(currentRevealedCount);
    setTimeElapsed(timeToSet);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficultyKey, initialBoardState, reviewMode, initialTimeElapsed, onInternalGameStatusChange]);

  useEffect(() => {
    let timerId: NodeJS.Timeout | undefined;
    if (gameStatus === 'playing' && !reviewMode && !isGameResolvedByLoad) {
      timerId = setInterval(() => {
        setTimeElapsed((prevTime) => prevTime + 1);
      }, 1000);
    }
    return () => clearInterval(timerId);
  }, [gameStatus, reviewMode, isGameResolvedByLoad]);

  useEffect(() => {
    if (board && difficulty) {
        setMinesRemaining(getRemainingMines(board, difficulty.mines));
    }
  }, [board, difficulty, gameStatus]);


  const handleCellClick = (x: number, y: number) => {
    const isControlClick = (window.event as MouseEvent)?.ctrlKey;

    if (gameStatus === 'lost' || gameStatus === 'won' || reviewMode) {
      return;
    }

    if (isControlClick) {
      handleCellContextMenu({ preventDefault: () => {} } as React.MouseEvent, x, y);
      return;
    }

    if (gameStatus === 'ready') {
      const { newBoard: boardAfterFirstClick, cellsRevealedThisTurn } = placeMinesAndRevealFirstArea(
        board,
        difficulty.rows,
        difficulty.cols,
        difficulty.mines,
        x,
        y
      );
      setBoard(boardAfterFirstClick);
      setRevealedCellsCount(prevCount => prevCount + cellsRevealedThisTurn);
      setGameStatus('playing'); // This will call onInternalGameStatusChange
      setMinesRemaining(getRemainingMines(boardAfterFirstClick, difficulty.mines));
      if (activeGameId && onMoveMade) {
        onMoveMade("reveal", x, y);
      }
      return;
    }

    const { newBoard, gameOver, cellsRevealedCount: newlyRevealed } = revealCell(
        board,
        difficulty.rows,
        difficulty.cols,
        x,
        y
    );

    setBoard(newBoard);

    let currentTotalRevealedCount = 0;
    newBoard.forEach(row => row.forEach(cell => {
      if (cell.isRevealed && !cell.isMine) currentTotalRevealedCount++;
    }));
    setRevealedCellsCount(currentTotalRevealedCount);

    if (activeGameId && onMoveMade) {
      onMoveMade("reveal", x, y);
    }

    if (gameOver) {
      setGameStatus('lost'); // This will call onInternalGameStatusChange
      if (!reviewMode) {
        setDialogMessage({
            title: 'Game Over!',
            description: (
                <>
                  You hit a mine. Better luck next time!
                </>
            ),
            icon: <Frown className="h-6 w-6 text-red-500" />
        });
        setShowDialog(true);
        onGameEnd?.('lost', timeElapsed, JSON.stringify(newBoard));
      }
    } else {
      if (checkWinCondition(newBoard, difficulty.rows, difficulty.cols, difficulty.mines)) {
        setGameStatus('won'); // This will call onInternalGameStatusChange
        if(!reviewMode){
          setDialogMessage({
            title: 'Congratulations!',
            description: (
                <>
                    You cleared the board!
                </>
            ),
            icon: <PartyPopper className="h-6 w-6 text-yellow-500" />
        });
          setShowDialog(true);
          onGameEnd?.('won', timeElapsed, JSON.stringify(newBoard));
        }
      }
    }
  };

  const handleCellContextMenu = (e: React.MouseEvent, x: number, y: number) => {
    e.preventDefault();
    if (gameStatus === 'lost' || gameStatus === 'won' || reviewMode) {
      return;
    }

    let currentBoard = board;
    if (gameStatus === 'ready') {
      const { newBoard: boardAfterMinePlacement } = placeMinesAndRevealFirstArea(
        board,
        difficulty.rows,
        difficulty.cols,
        difficulty.mines,
        x,
        y,
      );
      currentBoard = boardAfterMinePlacement.map(row => row.map(cell => ({...cell, isRevealed: false, exploded: false })));
      setGameStatus('playing'); // This will call onInternalGameStatusChange
    }

    const finalBoardState = toggleFlag(currentBoard, x, y);
    setBoard(finalBoardState);
    setMinesRemaining(getRemainingMines(finalBoardState, difficulty.mines));

    if (activeGameId && onMoveMade) {
      const cellAfterToggle = finalBoardState[y][x];
      if(cellAfterToggle.isFlagged) {
         onMoveMade("flag", x, y);
      } else {
         onMoveMade("unflag", x, y);
      }
    }
  };


  const getGameStatusIcon = () => {
    if (reviewMode && (gameStatus === 'won' || gameStatus === 'lost')) {
        return gameStatus === 'won' ? <PartyPopper className="h-8 w-8 text-yellow-500" /> : <Frown className="h-8 w-8 text-red-500" />;
    }
    if (reviewMode) return <Eye className="h-8 w-8 text-blue-500" />;
    if (gameStatus === 'won') return <PartyPopper className="h-8 w-8 text-yellow-500" />;
    if (gameStatus === 'lost') return <Frown className="h-8 w-8 text-red-500" />;
    return <Smile className="h-8 w-8 text-foreground" />;
  };

  const getGridStyle = () => {
    let cellSize = "minmax(20px, 1fr)";
    if (difficulty.cols <= 10 && difficulty.rows <=10) cellSize = "minmax(28px, 1fr)";
    else if (difficulty.cols > 20 || difficulty.rows > 20) cellSize = "minmax(18px, 1fr)";
    if (difficulty.cols > 25 || difficulty.rows > 25) cellSize = "minmax(16px, 1fr)";

    return {
      gridTemplateColumns: `repeat(${difficulty.cols}, ${cellSize})`,
      maxWidth: `${difficulty.cols * 40}px`,
    };
  };

  useImperativeHandle(ref, () => ({
    getCurrentBoardState: () => JSON.stringify(board),
    getCurrentTimeElapsed: () => timeElapsed,
    resetBoardToInitial: () => {
        if (!reviewMode) {
            resetGameInternals(difficultyKey);
        }
    },
    calculateTimeFromStart: (startTime: Timestamp) => {
        const now = Math.floor(Date.now() / 1000);
        const startSeconds = startTime.seconds;
        return Math.max(0, now - startSeconds);
    },
    requestHint: () => {
      if (gameStatus !== 'playing' && gameStatus !== 'ready' || reviewMode) return false; // Allow hint on 'ready'

      const hintCell = findSafeHintCell(board, difficulty.rows, difficulty.cols);
      if (hintCell) {
        handleCellClick(hintCell.x, hintCell.y); // This will handle game status transition if 'ready'
        return true;
      }
      return false;
    },
  }));


  return (
    <div className="flex flex-col items-center w-full p-2 sm:p-4">
      <div className="flex justify-between items-center w-full max-w-3xl mb-4 p-3 bg-card rounded-lg shadow">
        <div className="flex items-center text-lg font-semibold">
          <FlagIcon className="mr-2 h-5 w-5 text-red-500" />
          <span className="text-foreground tabular-nums">{String(minesRemaining).padStart(3, '0')}</span>
        </div>
        <Button
            variant="ghost"
            size="icon"
            onClick={() => { if(!reviewMode && (gameStatus === 'playing' || gameStatus === 'ready' || gameStatus === 'won' || gameStatus === 'lost')) resetGameInternals(difficultyKey) }}
            className="hover:bg-accent"
            disabled={reviewMode}
            title={reviewMode ? "Reviewing Game" : "Reset Game"}
        >
          {getGameStatusIcon()}
        </Button>
        <div className="flex items-center text-lg font-semibold">
          <Timer className="mr-2 h-5 w-5 text-blue-500" />
          <span className="text-foreground tabular-nums">{String(timeElapsed).padStart(3, '0')}</span>
        </div>
      </div>

      <div
        className="grid gap-0.5 bg-border p-1 rounded-md shadow-md overflow-auto"
        style={getGridStyle()}
        role="grid"
        aria-label={`Minesweeper board, ${difficulty.rows} rows by ${difficulty.cols} columns`}
      >
        {board.map((row, y_idx) =>
          row.map((cell, x_idx) => (
            <CellComponent
              key={`${y_idx}-${x_idx}-${gameStatus}-${cell.isRevealed}-${cell.isFlagged}-${cell.isMine}-${cell.adjacentMines}-${cell.exploded ?? 'noexplode'}-${cell.isReplayHighlight ?? 'nohighlight'}-${cell.isReplayHighlightBad ?? 'nogoodbad'}`}
              cell={cell}
              onClick={() => handleCellClick(x_idx, y_idx)}
              onContextMenu={(e) => handleCellContextMenu(e, x_idx, y_idx)}
            />
          ))
        )}
      </div>

      <AlertDialog open={showDialog && !reviewMode} onOpenChange={(open) => {if (!reviewMode) setShowDialog(open)}}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center">
                {dialogMessage.icon && <span className="mr-2">{dialogMessage.icon}</span>}
                {dialogMessage.title}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {dialogMessage.description}
              {(gameStatus === 'won' || gameStatus === 'lost') && <span className="block mt-2">Your time: {timeElapsed} seconds.</span>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
                setShowDialog(false);
            }}>
              Close
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setShowDialog(false);
              if (activeGameId) {
                router.push(`/history/game-review?gameId=${activeGameId}`);
              } else {
                console.warn("Cannot review game: activeGameId is null.");
              }
            }}>
              Review
            </AlertDialogAction>
            <AlertDialogAction onClick={() => {
              setShowDialog(false);
              resetGameInternals(difficultyKey);
              if (onGameEnd && (gameStatus === 'won' || gameStatus === 'lost')) {
                // PlayPage would need a callback or state change to fully restart.
              }
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

