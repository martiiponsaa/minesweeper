
// src/app/history/game-review/page.tsx
'use client';

import { GameSchema, type Game } from '@/lib/firebaseTypes';
import type { BoardState, CellState, DifficultySetting } from '@/lib/minesweeper'; // CellState import, DifficultySetting import
import { createInitialBoard, revealCell, toggleFlag, calculateAdjacentMines } from '@/lib/minesweeper';
import { DIFFICULTY_LEVELS, type DifficultyKey } from '@/config/minesweeperSettings';
import { useSearchParams } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout'; 
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, ChevronLeft, ChevronRight, Bomb } from 'lucide-react'; // Added Bomb
import React from 'react';
import GameBoard from '@/components/minesweeper/GameBoard';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Suspense } from 'react';
import { getFirebase } from '@/firebase';

const nonJsonGameStates = [
  "INITIAL_BOARD_STATE",
  "QUIT_FOR_NEW_GAME",
  "QUIT_ON_RESTART",
  "QUIT_ON_DIFFICULTY_CHANGE",
  "QUIT_STATE_UNKNOWN",
  "AUTO_QUIT_MULTIPLE_IN_PROGRESS",
];

import { addDoc, collection, Firestore, serverTimestamp } from "firebase/firestore";
import { useRouter } from 'next/navigation';
import { useFirestoreDocument } from '@/hooks/useFirestoreDocument';
import { UserSchema, type User } from '@/lib/firebaseTypes';
import { useAuth } from '@/hooks/useAuth'; 

function GameReviewContent() {
  const { user } = useAuth(); 
  const searchParams = useSearchParams();
  const gameId = searchParams.get('gameId');

  const { data: game, loading, error } = useFirestoreDocument<Game>(
    'games',
    gameId,
    GameSchema
  );

  const { firestore } = getFirebase();

  const [currentMoveIndex, setCurrentMoveIndex] = React.useState<number>(-1); 
  const [replayedBoardState, setReplayedBoardState] = React.useState<BoardState | null>(null);
  const [replayedTimeElapsed, setReplayedTimeElapsed] = React.useState<number>(0);
  const router = useRouter();
  const [showBombs, setShowBombs] = React.useState<boolean>(false);
  const [invalidGameStateForReplay, setInvalidGameStateForReplay] = React.useState<boolean>(false);


    const { data: targetUserData, loading: targetUserLoading, error: targetUserError } = useFirestoreDocument<User>(
        'users',
        game?.userId,
        UserSchema
    );

  const isOwnGame = game?.userId === user?.uid;

  React.useEffect(() => {
    if (!game?.difficulty) {
      setReplayedBoardState(null);
      setReplayedTimeElapsed(0);
      setInvalidGameStateForReplay(false);
      return;
    }

    const trimmedDifficulty = game.difficulty.trim(); // Trim whitespace

    let difficultySettings: DifficultySetting | undefined = DIFFICULTY_LEVELS[trimmedDifficulty as DifficultyKey];
    if (!difficultySettings) {
      // If not found by key, try by name (case-insensitive)
      difficultySettings = Object.values(DIFFICULTY_LEVELS).find(
        (level) => level.name.toLowerCase() === trimmedDifficulty.toLowerCase()
      );
    }
    
    if (!difficultySettings) {
      console.error(`Unknown difficulty: ${game.difficulty} (trimmed: ${trimmedDifficulty})`);
      setReplayedBoardState(null);
      setReplayedTimeElapsed(0);
      setInvalidGameStateForReplay(true); // Indicate an issue with game data
      return;
    }
    setInvalidGameStateForReplay(false); // Reset if difficulty is found


    let targetBoard: BoardState;
    let targetTime: number = 0;

    if (!game.moves || game.moves.length === 0) {
      if (game.gameState && !nonJsonGameStates.includes(game.gameState)) {
        try {
          targetBoard = JSON.parse(game.gameState) as BoardState;
          let needsRecalculate = targetBoard.some(row => row.some(cell => typeof cell.adjacentMines !== 'number'));
          if (needsRecalculate) {
            targetBoard = calculateAdjacentMines(targetBoard, difficultySettings.rows, difficultySettings.cols);
          }
        } catch (e) {
          console.error("Error parsing game.gameState for no-moves display:", e);
          targetBoard = createInitialBoard(difficultySettings.rows, difficultySettings.cols);
          setInvalidGameStateForReplay(true);
        }
      } else {
        targetBoard = createInitialBoard(difficultySettings.rows, difficultySettings.cols);
        if (game.gameState && nonJsonGameStates.includes(game.gameState) && currentMoveIndex >=0){
            setInvalidGameStateForReplay(true); // Non-JSON state means we can't truly know mines
        }
      }
      if (game.endTime && game.startTime) {
        targetTime = Math.round((game.endTime.toDate().getTime() - game.startTime.toDate().getTime()) / 1000);
      }
      setReplayedBoardState(targetBoard);
      setReplayedTimeElapsed(targetTime);
      return;
    }

    let trueMinedBoard: BoardState | null = null;
    
    if (game.gameState && !nonJsonGameStates.includes(game.gameState)) {
      try {
        trueMinedBoard = JSON.parse(game.gameState) as BoardState;
        // Basic validation for trueMinedBoard structure
        if (!Array.isArray(trueMinedBoard) || trueMinedBoard.length !== difficultySettings.rows || 
            (trueMinedBoard.length > 0 && trueMinedBoard[0].length !== difficultySettings.cols)) {
            console.error("Parsed game.gameState dimensions mismatch for replay.");
            setInvalidGameStateForReplay(true);
            trueMinedBoard = null; // Invalidate if dimensions are wrong
        } else {
            const hasAnyMineInfo = trueMinedBoard.some(row => row.some(cell => cell.isMine === true));
            if (!hasAnyMineInfo) {
                 console.warn("Warning: game.gameState for replay does not contain any mine information. Replay might be inaccurate.");
                 setInvalidGameStateForReplay(true); // Potentially inaccurate replay
            }
        }
      } catch (e) {
        console.error("Error parsing game.gameState for replay:", e);
        setInvalidGameStateForReplay(true);
      }
    } else {
      console.error("Cannot replay: game.gameState is not a valid board JSON for sourcing mine locations.");
      setInvalidGameStateForReplay(true);
    }

    if (!trueMinedBoard) {
        // If trueMinedBoard is null (due to parse error, dimension mismatch, or non-JSON state),
        // display an empty board and disable replay controls or show an error.
        setReplayedBoardState(createInitialBoard(difficultySettings.rows, difficultySettings.cols));
        // setInvalidGameStateForReplay(true); // Already set if we reach here
        return;
    }


    targetBoard = createInitialBoard(difficultySettings.rows, difficultySettings.cols);
    for (let r = 0; r < difficultySettings.rows; r++) {
      for (let c = 0; c < difficultySettings.cols; c++) {
        if (trueMinedBoard && trueMinedBoard[r] && trueMinedBoard[r][c]) {
          targetBoard[r][c].isMine = trueMinedBoard[r][c].isMine;
        } else {
          // This case should be less likely if trueMinedBoard has passed dimension checks
          console.warn(`Missing cell data in trueMinedBoard at ${r},${c} during board reconstruction.`);
          // Default to not a mine if data is missing to prevent errors
          targetBoard[r][c].isMine = false; 
        }
      }
    }
    targetBoard = calculateAdjacentMines(targetBoard, difficultySettings.rows, difficultySettings.cols);

    targetTime = 0; 

    if (currentMoveIndex >= 0 && game.moves && currentMoveIndex < game.moves.length) {
      for (let i = 0; i <= currentMoveIndex; i++) {
        const move = game.moves[i];
        if (!targetBoard[move.y] || !targetBoard[move.y][move.x]) {
            console.warn(`Move ${i} references invalid coordinates (${move.x}, ${move.y}). Skipping.`);
            continue;
        }
        if (move.action === 'reveal') {
          const result = revealCell(targetBoard, difficultySettings.rows, difficultySettings.cols, move.x, move.y); 
          targetBoard = result.newBoard;
          if (result.gameOver && i === currentMoveIndex && targetBoard[move.y][move.x].isMine) {
             targetBoard[move.y][move.x].exploded = true;
          }
        } else if (move.action === 'flag' || move.action === 'unflag') {
          targetBoard = toggleFlag(targetBoard, move.x, move.y);
        }
        if (i === currentMoveIndex && move.timestamp && game.startTime) {
            targetTime = Math.round((move.timestamp.toDate().getTime() - game.startTime.toDate().getTime()) / 1000);
        }
      }
      const currentActionedMove = game.moves[currentMoveIndex];
       if (targetBoard[currentActionedMove.y] && targetBoard[currentActionedMove.y][currentActionedMove.x]) {
        targetBoard[currentActionedMove.y][currentActionedMove.x].isReplayHighlight = true;
        
        let isBadMove = false;
        // trueMinedBoard should be valid here if we got this far
        const originalCellAtMove = trueMinedBoard![currentActionedMove.y]?.[currentActionedMove.x];


        if (currentActionedMove.action === 'reveal' && originalCellAtMove?.isMine) {
          isBadMove = true; 
        } else if (currentActionedMove.action === 'flag' && !originalCellAtMove?.isMine) {
          isBadMove = true; 
        }
        targetBoard[currentActionedMove.y][currentActionedMove.x].isReplayHighlightBad = isBadMove;
      }
    }
    setReplayedBoardState(targetBoard);
    setReplayedTimeElapsed(targetTime);

  }, [game, currentMoveIndex]);

  React.useEffect(() => {
    if (showBombs && game?.gameState && !nonJsonGameStates.includes(game.gameState) && !invalidGameStateForReplay) {
      try {
       const trueMinedBoard = JSON.parse(game.gameState) as BoardState;
       const boardWithBombsRevealed = JSON.parse(JSON.stringify(trueMinedBoard)) as BoardState; 
       boardWithBombsRevealed.forEach(row => row.forEach(cell => {
          cell.isRevealed = true;
          cell.exploded = false;
       }));
       setReplayedBoardState(boardWithBombsRevealed); 
      } catch (e) {
        console.error("Error parsing game.gameState for bomb reveal:", e);
      }
    } else if (!showBombs && game && !invalidGameStateForReplay) {
        const trimmedDifficulty = game.difficulty.trim();
        const difficultySettings = DIFFICULTY_LEVELS[trimmedDifficulty.toLowerCase() as DifficultyKey] || Object.values(DIFFICULTY_LEVELS).find(l => l.name.toLowerCase() === trimmedDifficulty.toLowerCase());

        if (difficultySettings && game.gameState && !nonJsonGameStates.includes(game.gameState)) {
             let targetBoard = createInitialBoard(difficultySettings.rows, difficultySettings.cols);
             try {
                 const trueMinedBoard = JSON.parse(game.gameState) as BoardState;
                 // Ensure trueMinedBoard matches dimensions before using it
                 if (Array.isArray(trueMinedBoard) && trueMinedBoard.length === difficultySettings.rows && 
                     (trueMinedBoard.length === 0 || trueMinedBoard[0].length === difficultySettings.cols)) {
                     
                     for (let r = 0; r < difficultySettings.rows; r++) {
                        for (let c = 0; c < difficultySettings.cols; c++) {
                            if (trueMinedBoard[r] && trueMinedBoard[r][c]) { // Check if cell exists
                                targetBoard[r][c].isMine = trueMinedBoard[r][c].isMine;
                            }
                        }
                     }
                     targetBoard = calculateAdjacentMines(targetBoard, difficultySettings.rows, difficultySettings.cols);
                 } else {
                    console.warn("Dimension mismatch or invalid trueMinedBoard when hiding bombs, using clean board.");
                 }
             } catch (e) {
                  console.error("Error parsing game.gameState when hiding bombs, using clean board", e);
             }


             if (currentMoveIndex >= 0 && game.moves && currentMoveIndex < game.moves.length) {
                for (let i = 0; i <= currentMoveIndex; i++) {
                    const move = game.moves[i];
                    if (!targetBoard[move.y] || !targetBoard[move.y][move.x]) continue;

                     if (move.action === 'reveal') {
                        const result = revealCell(targetBoard, difficultySettings.rows, difficultySettings.cols, move.x, move.y);
                         targetBoard = result.newBoard;
                         if (result.gameOver && i === currentMoveIndex && targetBoard[move.y][move.x].isMine) {
                             targetBoard[move.y][move.x].exploded = true;
                         }
                    } else if (move.action === 'flag' || move.action === 'unflag') {
                        targetBoard = toggleFlag(targetBoard, move.x, move.y);
                    }
                 }
                const currentActionedMove = game.moves[currentMoveIndex];
                if (targetBoard[currentActionedMove.y] && targetBoard[currentActionedMove.y][currentActionedMove.x]) {
                    targetBoard[currentActionedMove.y][currentActionedMove.x].isReplayHighlight = true;
                    try {
                         const trueMinedBoardForHighlight = JSON.parse(game.gameState) as BoardState;
                         let isBadMove = false;
                         const originalCellAtMove = trueMinedBoardForHighlight[currentActionedMove.y]?.[currentActionedMove.x];
                          if (currentActionedMove.action === 'reveal' && originalCellAtMove?.isMine) {
                             isBadMove = true;
                         } else if (currentActionedMove.action === 'flag' && !originalCellAtMove?.isMine) {
                             isBadMove = true;
                         }
                        targetBoard[currentActionedMove.y][currentActionedMove.x].isReplayHighlightBad = isBadMove;
                    } catch(e) {
                        console.warn("Could not determine bad move highlight due to gameState parse error when hiding bombs.")
                    }
                }
             }
             setReplayedBoardState(targetBoard);
        } else if (difficultySettings && !invalidGameStateForReplay) { // No valid gameState, but difficulty exists
            setReplayedBoardState(createInitialBoard(difficultySettings.rows, difficultySettings.cols));
        }
    }
  }, [showBombs, game, currentMoveIndex, invalidGameStateForReplay]); 

  return (
    <AppLayout>
      <div className="container mx-auto p-4 md:p-8">
            {game && ( 
              <div className="mb-4">
                {isOwnGame ? ( 
                  <Button variant="outline" onClick={() => router.push('/history')}>
                    <ChevronLeft className="mr-2 h-4 w-4" /> Back to My History
                  </Button>
                ) : (
                  targetUserLoading ? (
                    <Skeleton className="h-10 w-40" />
                  ) : targetUserError ? (
                    <p className="text-destructive">Error loading user data for back button: {targetUserError.message}</p>
                  ) : ( 
                    <Button variant="outline" onClick={() => router.push(`/history?id=${game.userId}`)}>
                      <ChevronLeft className="mr-2 h-4 w-4" /> Back to {targetUserData?.profilePreferences?.displayName || targetUserData?.username || 'Friend'}'s History
                    </Button>
                  ))}
              </div>
            )}


        <h1 className="text-3xl font-bold text-foreground mb-8">Game Review</h1>

    <>
      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-[200px] w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to load game data: {error.message}
          </AlertDescription>
        </Alert>
      )}

      {!loading && !error && !game && (
        <Alert variant="default">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Game Not Found</AlertTitle>
          <AlertDescription>
            No game found with the provided ID.
          </AlertDescription>
        </Alert>
      )}

      {game && (
        <Card>
          <CardHeader>
            <CardTitle>
              Game Review: {game.difficulty} - {game.result}
            </CardTitle>
            <CardDescription>
              Review the board state and details of this completed game.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {replayedBoardState && (
              <div className="flex flex-col items-center space-y-4">
                <div className="w-full p-0 sm:p-2 md:p-4">
                  <GameBoard
                    difficultyKey={(game.difficulty.trim().toLowerCase()) as DifficultyKey}
                    initialBoardState={JSON.stringify(replayedBoardState)}
                    initialTimeElapsed={replayedTimeElapsed}
                    reviewMode={true}
                    isGuest={true} 
                    activeGameId={game.id}
                  />
                </div>
                  <div className="w-full flex justify-between items-center">
                      <Button
                          onClick={() => setShowBombs(prev => !prev)}
                          variant={showBombs ? "secondary" : "outline"}
                          disabled={invalidGameStateForReplay && !showBombs}
                          title={invalidGameStateForReplay && !showBombs ? "Cannot show bombs, game data is incomplete." : (showBombs ? "Hide Bombs" : "Show All Bombs")}
                      >
                        <Bomb className="mr-2 h-4 w-4" /> {showBombs ? "Hide Bombs" : "Show All Bombs"}
                      </Button>
                      {isOwnGame && ( // Only show "Continue from this point" for own games
                        <Button
                            onClick={async () => {
                              if (!replayedBoardState) {
                                  console.error("Cannot continue from this point: replayedBoardState is null.");
                                  return;
                              }
                              if (!game?.difficulty) {
                                  console.error("Cannot continue from this point: game difficulty is not available.");
                                  return;
                              }
                              if (!user) {
                                  console.error("Cannot continue from this point: user not logged in.");
                                  return;
                              }
                              try {
                                const newGameRef = await addDoc(collection(firestore, "games"), {
                                  difficulty: game.difficulty, // Use original difficulty
                                  endTime: null, // New game, no end time
                                  gameState: JSON.stringify(replayedBoardState), // Current replayed state
                                  moves: [], // Start with no moves from this point
                                  result: 'in-progress',
                                  startTime: serverTimestamp(), // New start time
                                  userId: user.uid, // Logged-in user
                                });
                                router.push(`/play`); // Navigate to play page, which should load this new in-progress game
                              } catch (e) {
                                console.error("Error creating new game document:", e);
                              }
                            }}
                            variant="outline"
                            disabled={showBombs || invalidGameStateForReplay}
                            title={showBombs ? "Hide bombs to enable continuation." : (invalidGameStateForReplay ? "Cannot continue, game data is incomplete." : "Start a new game from this board state.")}
                        >
                            Continue from this point
                        </Button>
                      )}
                  </div>
                

                {game.moves && game.moves.length > 0 && !invalidGameStateForReplay && (
                  <div className="flex justify-center items-center space-x-4">
                    <Button
                      onClick={() => setCurrentMoveIndex(prev => Math.max(-1, prev - 1))}
                      disabled={currentMoveIndex <= -1}
                      variant="outline"
                    >
                      <ChevronLeft className="mr-2 h-4 w-4" /> Previous
                    </Button>
                    <span className="text-sm text-muted-foreground tabular-nums w-40 text-center">
                      {currentMoveIndex === -1
                        ? `Initial Board (Move 0 / ${game.moves?.length || 0})`
                        : `Move: ${currentMoveIndex + 1} / ${game.moves?.length || 0}`}
                    </span>
                    <Button
                      onClick={() => setCurrentMoveIndex(prev => Math.min((game.moves?.length || 0) - 1, prev + 1))}
                      disabled={currentMoveIndex >= (game.moves?.length || 0) - 1}
                      variant="outline"
                    >
                      Next <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}
            
            {invalidGameStateForReplay && (
                 <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Replay Unavailable or Inaccurate</AlertTitle>
                    <AlertDescription>
                        The stored game data (`gameState`) for this game is incomplete, missing mine locations, or not in a valid format.
                        As a result, replaying moves may not accurately reflect the original game. The board shown might be an empty or default state.
                    </AlertDescription>
                 </Alert>
            )}


            {game.moves && game.moves.length === 0 && !invalidGameStateForReplay && (
               <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Replay Available</AlertTitle>
                <AlertDescription>
                  No moves were recorded for this game. The final board state (if available and valid) is shown.
                </AlertDescription>
              </Alert>
            )}
             {!replayedBoardState && game.moves && game.moves.length > 0 && !invalidGameStateForReplay && (
               <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Loading Replay</AlertTitle>
                <AlertDescription>
                  Board state is currently being reconstructed for replay.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </>
    </div>
    </AppLayout>
  )
}

export default function GameReviewPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen"><p>Loading game review...</p></div>}><GameReviewContent /></Suspense>
  );
}

