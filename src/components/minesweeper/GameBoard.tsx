
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
}

export interface GameBoardRef {
  getCurrentBoardState: () => string;
  getCurrentTimeElapsed: () => number;
  resetBoardToInitial: () => void; 
  calculateTimeFromStart: (startTime: Timestamp) => number;
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
}, ref) => {
  const [difficulty, setDifficulty] = useState<DifficultySetting>(DIFFICULTY_LEVELS[difficultyKey]);
  
  const [board, setBoard] = useState<BoardState>(() => {
    const currentDifficultySettings = DIFFICULTY_LEVELS[difficultyKey];
    if (initialBoardState && !nonJsonGameStates.includes(initialBoardState)) {
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
    return createInitialBoard(currentDifficultySettings.rows, currentDifficultySettings.cols);
  });

  const [gameStatus, setGameStatus] = useState<GameStatus>(() => {
    // In review mode, status is 'playing' to show board, but interactions are disabled.
    // Game ending logic (win/loss dialogs) is also suppressed.
    if (reviewMode) return 'playing'; 
    return initialBoardState && !nonJsonGameStates.includes(initialBoardState) ? 'playing' : 'ready';
  });

  const [minesRemaining, setMinesRemaining] = useState<number>(() => {
      const currentDifficultySettings = DIFFICULTY_LEVELS[difficultyKey];
      // In review mode, calculate based on actual mines in loaded state if possible, else default
      if (reviewMode && initialBoardState && !nonJsonGameStates.includes(initialBoardState)) {
        try {
          const parsedBoard = JSON.parse(initialBoardState) as BoardState;
          return getRemainingMines(parsedBoard, currentDifficultySettings.mines);
        } catch (e) { /* fallback to default */ }
      }
      return getRemainingMines(board, currentDifficultySettings.mines);
  });

  const [timeElapsed, setTimeElapsed] = useState<number>(initialTimeElapsed);
  const [firstClick, setFirstClick] = useState<boolean>(reviewMode ? false : (!initialBoardState || nonJsonGameStates.includes(initialBoardState ?? "")));
  
  const [revealedCellsCount, setRevealedCellsCount] = useState<number>(() => {
    let count = 0;
    board.forEach(row => row.forEach(cell => {
        if (cell.isRevealed && !cell.isMine) count++;
    }));
    return count;
  });

  const [showDialog, setShowDialog] = useState<boolean>(false);
  const [dialogMessage, setDialogMessage] = useState<{title: string, description: string, icon?: React.ReactNode}>({title: '', description: '', icon: undefined});
  
  // This state helps prevent game end logic from re-triggering if board is loaded in a resolved state
  const [isGameResolvedByLoad, setIsGameResolvedByLoad] = useState(
    initialBoardState && !nonJsonGameStates.includes(initialBoardState) && 
    (gameStatus === 'won' || gameStatus === 'lost') && !reviewMode
  );


  const resetGameInternals = useCallback((newDifficultyKey: DifficultyKey, keepDialog = false) => {
    if (reviewMode) return; 
    const newDifficultySettings = DIFFICULTY_LEVELS[newDifficultyKey];
    setDifficulty(newDifficultySettings);
    setBoard(createInitialBoard(newDifficultySettings.rows, newDifficultySettings.cols));
    setGameStatus('ready');
    setMinesRemaining(newDifficultySettings.mines);
    setTimeElapsed(0); 
    setFirstClick(true);
    setRevealedCellsCount(0);
    setIsGameResolvedByLoad(false);
    if (!keepDialog) {
      setShowDialog(false);
    }
  }, [reviewMode]);


  useEffect(() => {
    const newDifficultySettings = DIFFICULTY_LEVELS[difficultyKey];
    setDifficulty(newDifficultySettings);

    if (initialBoardState && !nonJsonGameStates.includes(initialBoardState)) {
        try {
            const parsedBoardInput = JSON.parse(initialBoardState) as BoardState;
             if (Array.isArray(parsedBoardInput) && parsedBoardInput.length > 0 && Array.isArray(parsedBoardInput[0]) &&
                parsedBoardInput.length === newDifficultySettings.rows && parsedBoardInput[0].length === newDifficultySettings.cols) {
                
                const processedBoard = calculateAdjacentMines(parsedBoardInput, newDifficultySettings.rows, newDifficultySettings.cols);
                setBoard(processedBoard);

                let currentRevealedCount = 0;
                processedBoard.forEach(row => row.forEach(cell => {
                    if(cell.isRevealed && !cell.isMine) currentRevealedCount++;
                }));
                setRevealedCellsCount(currentRevealedCount);
                setMinesRemaining(getRemainingMines(processedBoard, newDifficultySettings.mines));
                
                // If not in review mode, determine if the loaded game state is already won or lost
                if (!reviewMode) {
                    if (checkWinCondition(processedBoard, newDifficultySettings.rows, newDifficultySettings.cols, newDifficultySettings.mines)) {
                        setGameStatus('won');
                        setIsGameResolvedByLoad(true); // Mark as resolved by load
                    } else {
                        // Check for loss condition (a mine is revealed and exploded)
                        const lost = processedBoard.some(row => row.some(cell => cell.isMine && cell.isRevealed && cell.exploded));
                        if (lost) {
                            setGameStatus('lost');
                            setIsGameResolvedByLoad(true); // Mark as resolved by load
                        } else {
                           setGameStatus('playing'); // If not won or lost, it's in progress
                           setIsGameResolvedByLoad(false);
                        }
                    }
                } else {
                    setGameStatus('playing'); // In review, always 'playing' to show board
                }
                setFirstClick(false); // Game is loaded, so not the first click anymore
            } else {
                 console.warn("Parsed initialBoardState structure mismatch, falling back to new board.");
                 if (!reviewMode) resetGameInternals(difficultyKey);
                 else setBoard(createInitialBoard(newDifficultySettings.rows, newDifficultySettings.cols));
            }
        } catch (e) {
            console.error("Error processing initialBoardState, falling back to new board:", e);
            if (!reviewMode) resetGameInternals(difficultyKey);
            else setBoard(createInitialBoard(newDifficultySettings.rows, newDifficultySettings.cols));
        }
    } else {
        if (!reviewMode) resetGameInternals(difficultyKey);
        else setBoard(createInitialBoard(newDifficultySettings.rows, newDifficultySettings.cols));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficultyKey, initialBoardState, reviewMode]); 

  useEffect(() => {
    setTimeElapsed(initialTimeElapsed);
  }, [initialTimeElapsed]);

  useEffect(() => {
    let timerId: NodeJS.Timeout | undefined;
    if (gameStatus === 'playing' && !reviewMode && !isGameResolvedByLoad) { 
      timerId = setInterval(() => {
        setTimeElapsed((prevTime) => prevTime + 1);
      }, 1000);
    }
    return () => clearInterval(timerId);
  }, [gameStatus, reviewMode, isGameResolvedByLoad]);

  const handleCellClick = (x: number, y: number) => {
    if (reviewMode || gameStatus === 'lost' || gameStatus === 'won' || board[y][x].isFlagged || board[y][x].isRevealed) {
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


    if (activeGameId && onMoveMade) {
      onMoveMade("reveal", x, y);
    }
    if (gameOver) {
      setGameStatus('lost');
      if (!reviewMode) {
        setDialogMessage({ title: 'Game Over!', description: 'You hit a mine. Better luck next time!', icon: <Frown className="h-6 w-6 text-red-500" /> });
        setShowDialog(true);
        onGameEnd?.('lost', timeElapsed, JSON.stringify(newBoard));
      }
    } else {
      if (checkWinCondition(newBoard, difficulty.rows, difficulty.cols, difficulty.mines)) {
        setGameStatus('won');
        if(!reviewMode){
          setDialogMessage({ title: 'Congratulations!', description: 'You cleared the board!', icon: <PartyPopper className="h-6 w-6 text-yellow-500" /> });
          setShowDialog(true);
          onGameEnd?.('won', timeElapsed, JSON.stringify(newBoard));
        }
      }
    }
  };

  const handleCellContextMenu = (e: React.MouseEvent, x: number, y: number) => {
    e.preventDefault();
    if (reviewMode || gameStatus === 'lost' || gameStatus === 'won' || board[y][x].isRevealed) {
      return;
    }
    
    let currentBoard = board; 
    if (gameStatus === 'ready' && firstClick) {
        // Mines are not placed on flag action usually, but if it's the very first action on board.
        // To maintain consistency with click, we can place mines here too.
        // Or, defer mine placement until a reveal. For simplicity, let's keep it consistent:
        // currentBoard = placeMines(board, difficulty.rows, difficulty.cols, difficulty.mines, x, y);
        // setFirstClick(false);   
        setGameStatus('playing'); // Set status to playing on first interaction
    } else if (gameStatus === 'ready' && !firstClick) { 
        setGameStatus('playing');
    }

    const newBoardAfterFlag = toggleFlag(currentBoard, x, y);
    setBoard(newBoardAfterFlag);
    setMinesRemaining(getRemainingMines(newBoardAfterFlag, difficulty.mines));

    if (activeGameId && onMoveMade) {
      onMoveMade(newBoardAfterFlag[y][x].isFlagged ? "flag" : "unflag", x, y);
    }
  };


  const getGameStatusIcon = () => {
    if (reviewMode) return <Eye className="h-8 w-8 text-blue-500" />;
    if (gameStatus === 'won') return <PartyPopper className="h-8 w-8 text-yellow-500" />;
    if (gameStatus === 'lost') return <Frown className="h-8 w-8 text-red-500" />;
    return <Smile className="h-8 w-8 text-foreground" />;
  };
  
  const getGridStyle = () => {
    let cellSize = "minmax(20px, 1fr)"; // Default for smaller boards
    if (difficulty.cols <= 10 && difficulty.rows <=10) cellSize = "minmax(28px, 1fr)"; // Larger cells for easy
    else if (difficulty.cols > 20 || difficulty.rows > 20) cellSize = "minmax(18px, 1fr)"; // Medium cells
    if (difficulty.cols > 25 || difficulty.rows > 25) cellSize = "minmax(16px, 1fr)"; // Smaller for hard

    return {
      gridTemplateColumns: `repeat(${difficulty.cols}, ${cellSize})`,
      maxWidth: `${difficulty.cols * 40}px`, // Max width constraint
    };
  };

  useImperativeHandle(ref, () => ({
    getCurrentBoardState: () => JSON.stringify(board),
    getCurrentTimeElapsed: () => timeElapsed,
    resetBoardToInitial: () => { 
        if (!reviewMode) {
            resetGameInternals(difficultyKey);
            setTimeElapsed(0);
        }
    },
    calculateTimeFromStart: (startTime: Timestamp) => {
        const now = Math.floor(Date.now() / 1000); 
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
        <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => { if(!reviewMode) resetGameInternals(difficultyKey)}} 
            className="hover:bg-accent"
            disabled={reviewMode}
            title={reviewMode ? "Reviewing Game" : "Reset Game"}
        >
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
              key={`${y}-${x}-${gameStatus}-${cell.isRevealed}-${cell.isFlagged}-${cell.isMine}-${cell.adjacentMines}-${cell.exploded ?? 'noexplode'}`} 
              cell={cell}
              onClick={() => handleCellClick(x, y)}
              onContextMenu={(e) => handleCellContextMenu(e, x, y)}
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
               {gameStatus === 'won' && <span className="block mt-2">Your time: {timeElapsed} seconds.</span>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
                setShowDialog(false);
                 if (onGameEnd && (gameStatus === 'won' || gameStatus === 'lost')) {
                    // Parent (PlayPage) handles further actions based on onGameEnd callback.
                 }
            }}>
              Close
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => {
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

    
