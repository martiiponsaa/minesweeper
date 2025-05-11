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
  placeMines, // Import placeMines
} from '@/lib/minesweeper';
import { DIFFICULTY_LEVELS, type DifficultyKey, type DifficultySetting } from '@/config/minesweeperSettings';
import { Button } from '@/components/ui/button';
import { Smile, Frown, PartyPopper, Timer, Flag as FlagIcon, Eye, ChevronLeft, ChevronRight } from 'lucide-react'; // Added Chevron icons
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
    if (initialBoardState && !nonJsonGameStates.includes(initialBoardState) && !reviewMode) {
      try {
        const parsedBoard = JSON.parse(initialBoardState) as BoardState;
        if (Array.isArray(parsedBoard) && parsedBoard.length > 0 && Array.isArray(parsedBoard[0])) {
            if (parsedBoard.every(row => Array.isArray(row) && row.every(cell => typeof cell.isRevealed === 'boolean'))) {
                if (parsedBoard.length === currentDifficultySettings.rows && parsedBoard[0].length === currentDifficultySettings.cols) {
                    // For loaded games, ensure adjacent mines are up-to-date
                    let boardToReturn = parsedBoard;
                    // Check if adjacentMines need recalculation (e.g. old saved state)
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
    // For new games, review mode (which gets initialBoard later), or if parsing failed
    return createInitialBoard(currentDifficultySettings.rows, currentDifficultySettings.cols);
  });

  const [gameStatus, setGameStatus] = useState<GameStatus>(() => {
    if (reviewMode && initialBoardState && !nonJsonGameStates.includes(initialBoardState)) { 
        try {
            const parsedBoard = JSON.parse(initialBoardState) as BoardState;
             if (checkWinCondition(parsedBoard, DIFFICULTY_LEVELS[difficultyKey].rows, DIFFICULTY_LEVELS[difficultyKey].cols, DIFFICULTY_LEVELS[difficultyKey].mines)) {
                return 'won';
            }
            if (parsedBoard.some(row => row.some(cell => cell.isMine && cell.isRevealed && cell.exploded))) {
                return 'lost';
            }
        } catch(e) { /* ignore parsing error for review status */ }
        return 'playing'; 
    }
    if (initialBoardState && !nonJsonGameStates.includes(initialBoardState) && !reviewMode) {
        try {
            const parsedBoard = JSON.parse(initialBoardState) as BoardState;
            const currentDifficultySettings = DIFFICULTY_LEVELS[difficultyKey];
            // Re-check win/loss based on the actual board state, as it might have been calculated already
            if (parsedBoard.some(row => row.some(cell => cell.isMine && cell.isRevealed && cell.exploded))) {
                 return 'lost';
            }
            if (checkWinCondition(parsedBoard, currentDifficultySettings.rows, currentDifficultySettings.cols, currentDifficultySettings.mines)) {
                return 'won';
            }
            return 'playing'; 
        } catch (e) {
            // Fallback
        }
    }
    return 'ready'; 
  });

  const [minesRemaining, setMinesRemaining] = useState<number>(() => {
      const currentDifficultySettings = DIFFICULTY_LEVELS[difficultyKey];
      // Calculate based on board passed to useState, not the one from createInitialBoard directly if initialBoardState was used.
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
    setGameStatus('ready');
    setMinesRemaining(getRemainingMines(freshBoard, newDifficultySettings.mines)); 
    setTimeElapsed(0); 
    setIsGameResolvedByLoad(false);
    setRevealedCellsCount(0);
    if (!keepDialog) {
      setShowDialog(false);
    }
  }, [reviewMode]); 


  useEffect(() => {
    const newDifficultySettings = DIFFICULTY_LEVELS[difficultyKey];
    setDifficulty(newDifficultySettings);

    let boardToSet: BoardState;
    let statusToSet: GameStatus = 'ready';
    let resolvedByLoad = false;
    let timeToSet = initialTimeElapsed > 0 ? initialTimeElapsed : 0; // Ensure initialTimeElapsed isn't negative

    if (reviewMode && initialBoardState && !nonJsonGameStates.includes(initialBoardState)) {
        // Review mode: directly use the provided board state
        try {
            const parsedBoardForReview = JSON.parse(initialBoardState) as BoardState;
            if (parsedBoardForReview.length === newDifficultySettings.rows && parsedBoardForReview[0].length === newDifficultySettings.cols) {
                boardToSet = calculateAdjacentMines(parsedBoardForReview, newDifficultySettings.rows, newDifficultySettings.cols);
                 // Determine status from game data or infer from board
                if (checkWinCondition(boardToSet, newDifficultySettings.rows, newDifficultySettings.cols, newDifficultySettings.mines)) {
                    statusToSet = 'won';
                } else if (boardToSet.some(row => row.some(cell => cell.isMine && cell.isRevealed && cell.exploded))) {
                    statusToSet = 'lost';
                } else {
                    statusToSet = 'playing'; // Or could be based on an explicit 'quit' status from Game data if available
                }
            } else {
                 console.warn("Review mode: initialBoardState dimensions mismatch, showing empty board.");
                 boardToSet = createInitialBoard(newDifficultySettings.rows, newDifficultySettings.cols);
                 statusToSet = 'playing'; // Default for review
            }
        } catch (e) {
            console.error("Error parsing initialBoardState for review mode:", e);
            boardToSet = createInitialBoard(newDifficultySettings.rows, newDifficultySettings.cols);
            statusToSet = 'playing';
        }
    } else if (initialBoardState && !nonJsonGameStates.includes(initialBoardState) && !reviewMode) {
        // Play mode with an initial board state (loading a game)
        try {
            const parsedBoardInput = JSON.parse(initialBoardState) as BoardState;
             if (Array.isArray(parsedBoardInput) && parsedBoardInput.length > 0 && Array.isArray(parsedBoardInput[0]) &&
                parsedBoardInput.length === newDifficultySettings.rows && parsedBoardInput[0].length === newDifficultySettings.cols) {
                
                boardToSet = parsedBoardInput; // Assume it already has correct mine counts or will be recalculated
                // Check if adj mines need calculation
                const needsRecalc = boardToSet.some(row => row.some(c => typeof c.adjacentMines !== 'number'));
                if(needsRecalc){
                    boardToSet = calculateAdjacentMines(boardToSet, newDifficultySettings.rows, newDifficultySettings.cols);
                }

                if (boardToSet.some(row => row.some(cell => cell.isMine && cell.isRevealed && cell.exploded))) {
                    statusToSet = 'lost';
                    resolvedByLoad = true;
                } else if (checkWinCondition(boardToSet, newDifficultySettings.rows, newDifficultySettings.cols, newDifficultySettings.mines)) {
                    statusToSet = 'won';
                    resolvedByLoad = true;
                } else {
                   statusToSet = 'playing'; 
                }
            } else {
                 console.warn("Parsed initialBoardState structure/dimensions mismatch, falling back to new board for play mode.");
                 boardToSet = createInitialBoard(newDifficultySettings.rows, newDifficultySettings.cols);
                 statusToSet = 'ready';
                 timeToSet = 0; 
            }
        } catch (e) {
            console.error("Error processing initialBoardState, falling back to new board for play mode:", e);
            boardToSet = createInitialBoard(newDifficultySettings.rows, newDifficultySettings.cols);
            statusToSet = 'ready';
            timeToSet = 0;
        }
    } else { 
        // New game or no initial state provided for play mode
        boardToSet = createInitialBoard(newDifficultySettings.rows, newDifficultySettings.cols);
        statusToSet = 'ready';
        timeToSet = 0; 
    }

    setBoard(boardToSet);
    setMinesRemaining(getRemainingMines(boardToSet, newDifficultySettings.mines));
    setGameStatus(statusToSet);
    setIsGameResolvedByLoad(resolvedByLoad && !reviewMode);
    
    let currentRevealedCount = 0;
    boardToSet.forEach(row => row.forEach(cell => {
        if(cell.isRevealed && !cell.isMine) currentRevealedCount++;
    }));
    setRevealedCellsCount(currentRevealedCount);
    setTimeElapsed(timeToSet);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficultyKey, initialBoardState, reviewMode, initialTimeElapsed]); 

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
  }, [board, difficulty]);


  const handleCellClick = (x: number, y: number) => {
    if (reviewMode || gameStatus === 'lost' || gameStatus === 'won' || board[y][x].isFlagged || board[y][x].isRevealed) {
      return;
    }
    
    let currentBoardForReveal = board.map(row => row.map(cell => ({...cell, isReplayHighlight: false, isReplayHighlightBad: false }))); // Clear previous highlights
    let statusForReveal = gameStatus;

    if(gameStatus === 'ready'){
      // Mines are placed by revealCell if status is 'ready'
      // The first click (reveal) should not be a mine.
      currentBoardForReveal = placeMines(currentBoardForReveal, difficulty.rows, difficulty.cols, difficulty.mines, x, y);
      currentBoardForReveal = calculateAdjacentMines(currentBoardForReveal, difficulty.rows, difficulty.cols);
      statusForReveal = 'playing'; 
      setGameStatus('playing'); 
    }

    const { newBoard, gameOver, cellsRevealedCount: newlyRevealed } = revealCell(
        currentBoardForReveal, 
        difficulty.rows, 
        difficulty.cols, 
        x, 
        y, 
        statusForReveal, // Pass the potentially updated status ('playing')
        difficulty.mines // This is relevant for the `placeMines` call within `revealCell` if status was 'ready'
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
      setGameStatus('lost');
      if (!reviewMode) {
        setDialogMessage({ 
            title: 'Game Over!', 
            description: (
                <>
                  You hit a mine. Better luck next time!
                  {/* Time display moved out of here, shown dynamically */}
                </>
            ), 
            icon: <Frown className="h-6 w-6 text-red-500" /> 
        });
        setShowDialog(true);
        onGameEnd?.('lost', timeElapsed, JSON.stringify(newBoard));
      }
    } else {
      if (checkWinCondition(newBoard, difficulty.rows, difficulty.cols, difficulty.mines)) {
        setGameStatus('won');
        if(!reviewMode){
          setDialogMessage({ 
            title: 'Congratulations!', 
            description: (
                <>
                    You cleared the board!
                     {/* Time display moved out of here, shown dynamically */}
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
    if (reviewMode || gameStatus === 'lost' || gameStatus === 'won' || board[y][x].isRevealed) {
      return;
    }

    let finalBoardState: BoardState;
    let boardForFlagging = board.map(row => row.map(cell => ({...cell, isReplayHighlight: false, isReplayHighlightBad: false })));


    if (gameStatus === 'ready') {
        const currentDifficultySettings = DIFFICULTY_LEVELS[difficultyKey];
        
        // For a first flag, place mines randomly across the entire board.
        // The safe zone concept is typically for the first *reveal*.
        let initializedBoard = placeMines(boardForFlagging, currentDifficultySettings.rows, currentDifficultySettings.cols, currentDifficultySettings.mines); // No firstClickX/Y for safe zone
        
        initializedBoard = calculateAdjacentMines(initializedBoard, currentDifficultySettings.rows, currentDifficultySettings.cols);
        
        finalBoardState = toggleFlag(initializedBoard, x, y);
        setGameStatus('playing'); 
    } else {
        // Game is already 'playing'
        finalBoardState = toggleFlag(boardForFlagging, x, y);
    }

    setBoard(finalBoardState);
    
    if (activeGameId && onMoveMade) {
      onMoveMade(finalBoardState[y][x].isFlagged ? "flag" : "unflag", x, y);
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
    }
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
            onClick={() => { if(!reviewMode && (gameStatus === 'playing' || gameStatus === 'ready')) resetGameInternals(difficultyKey) }} 
            className="hover:bg-accent"
            disabled={reviewMode || gameStatus === 'won' || gameStatus === 'lost'}
            title={reviewMode ? "Reviewing Game" : (gameStatus === 'won' || gameStatus === 'lost' ? "Game Ended" : "Reset Game")}
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
                // No automatic quit on close. User must explicitly quit or start new game via PlayPage controls.
            }}>
              Close
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setShowDialog(false); // Close dialog first
              // This should ideally trigger a function passed from PlayPage to handle full restart including Firestore ops
              resetGameInternals(difficultyKey); 
              // To truly "Play Again" as a new game, PlayPage's handleRestartGame or handleStartGame should be invoked
              // For now, it resets the board for local replay. PlayPage handles new game creation.
              if (onGameEnd && (gameStatus === 'won' || gameStatus === 'lost')) {
                // Signal that the user wants to play again, PlayPage can then decide to start a new game session
                // For now, this will be handled by the user clicking "Start Game" again on the PlayPage
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

