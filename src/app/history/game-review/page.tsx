// src/app/history/game-review/page.tsx
'use client';

import { GameSchema, type Game } from '@/lib/firebaseTypes';
import type { BoardState, CellState } from '@/lib/minesweeper'; // CellState import
import { createInitialBoard, revealCell, toggleFlag, calculateAdjacentMines } from '@/lib/minesweeper';
import { DIFFICULTY_LEVELS, type DifficultyKey } from '@/config/minesweeperSettings';
import { useSearchParams } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout'; 
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
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
import { useAuth } from '@/hooks/useAuth'; // Import useAuth hook
function GameReviewContent() {
  const { user } = useAuth(); // Assuming useAuth is imported and provides the logged-in user
  const searchParams = useSearchParams();
  const gameId = searchParams.get('gameId');

  const { data: game, loading, error } = useFirestoreDocument<Game>(
    'games',
    gameId,
    GameSchema
  );

  // Get the user ID from the URL (if coming from a user's history)
  const userIdFromUrl = searchParams.get('id');

  const { firestore } = getFirebase();

  const [currentMoveIndex, setCurrentMoveIndex] = React.useState<number>(-1); // Start at -1 for initial board (Move 0)
  const [replayedBoardState, setReplayedBoardState] = React.useState<BoardState | null>(null);
  const [replayedTimeElapsed, setReplayedTimeElapsed] = React.useState<number>(0);
  const router = useRouter();
  const [showBombs, setShowBombs] = React.useState<boolean>(false);
  const [hasShownBombs, setHasShownBombs] = React.useState<boolean>(false);

    // Fetch target user data (friend's data if userIdFromUrl is present)
    const { data: targetUserData, loading: targetUserLoading, error: targetUserError } = useFirestoreDocument<User>(
        'users',
        game?.userId,
        UserSchema
    );

  // Determine if the game belongs to the logged-in user
  const isOwnGame = game?.userId === user?.uid;



  React.useEffect(() => {
    if (!game?.difficulty) {
      setReplayedBoardState(null);
      setReplayedTimeElapsed(0);
      return;
    }
    const difficultySettings = Object.values(DIFFICULTY_LEVELS).find(
      (level) => level.name === game.difficulty
    );
    if (!difficultySettings) {
      console.error(`Unknown difficulty: ${game.difficulty}`);
      setReplayedBoardState(null);
      setReplayedTimeElapsed(0);
      return;
    }

    let targetBoard: BoardState;
    let targetTime: number = 0;

    // Case 1: No moves to replay (or game quit early)
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
        }
      } else {
        targetBoard = createInitialBoard(difficultySettings.rows, difficultySettings.cols);
      }
      if (game.endTime && game.startTime) {
        targetTime = Math.round((game.endTime.toDate().getTime() - game.startTime.toDate().getTime()) / 1000);
      }
      setReplayedBoardState(targetBoard);
      setReplayedTimeElapsed(targetTime);
      return;
    }

    // Case 2: Replay moves
    let trueMinedBoard: BoardState | null = null;
    
    if (game.gameState && !nonJsonGameStates.includes(game.gameState)) {
      try {
        trueMinedBoard = JSON.parse(game.gameState) as BoardState;
      } catch (e) {
        console.error("Error parsing game.gameState for replay:", e);
        // Fallback to initial board but we can't replay accurately without trueMinedBoard
        setReplayedBoardState(createInitialBoard(difficultySettings.rows, difficultySettings.cols));
        return;
      }
    } else {
      console.error("Cannot replay: game.gameState is not a valid board JSON for sourcing mine locations.");
      setReplayedBoardState(createInitialBoard(difficultySettings.rows, difficultySettings.cols));
      return;
    }

    targetBoard = createInitialBoard(difficultySettings.rows, difficultySettings.cols);
    for (let r = 0; r < difficultySettings.rows; r++) {
      for (let c = 0; c < difficultySettings.cols; c++) {
        if (trueMinedBoard && trueMinedBoard[r] && trueMinedBoard[r][c]) {
          targetBoard[r][c].isMine = trueMinedBoard[r][c].isMine;
          targetBoard[r][c].adjacentMines = trueMinedBoard[r][c].adjacentMines;
        } else {
          console.warn(`Missing cell data in trueMinedBoard at ${r},${c}`);
        }
      }
    }
    // Ensure adjacent mines are calculated for the clean targetBoard based on trueMinedBoard's mines
    targetBoard = calculateAdjacentMines(targetBoard, difficultySettings.rows, difficultySettings.cols);

    targetTime = 0; // Default for initial state (currentMoveIndex === -1)

    if (currentMoveIndex >= 0 && game.moves && currentMoveIndex < game.moves.length) {
      for (let i = 0; i <= currentMoveIndex; i++) {
        const move = game.moves[i];
        if (move.action === 'reveal') {
          const result = revealCell(targetBoard, difficultySettings.rows, difficultySettings.cols, move.x, move.y); // 'playing', 0 for mines assumes mines already set
          targetBoard = result.newBoard;
          if (result.gameOver && i === currentMoveIndex && targetBoard[move.y][move.x].isMine) {
             targetBoard[move.y][move.x].exploded = true;
          }
        } else if (move.action === 'flag' || move.action === 'unflag') {
          targetBoard = toggleFlag(targetBoard, move.x, move.y);
        }
        // Update time based on the *current* move being processed in the loop IF it's the last one to be applied
        if (i === currentMoveIndex && move.timestamp && game.startTime) {
            targetTime = Math.round((move.timestamp.toDate().getTime() - game.startTime.toDate().getTime()) / 1000);
        }
      }
      // Highlight the cell of the current actioned move
      const currentActionedMove = game.moves[currentMoveIndex];
      if (targetBoard[currentActionedMove.y] && targetBoard[currentActionedMove.y][currentActionedMove.x]) {
        targetBoard[currentActionedMove.y][currentActionedMove.x].isReplayHighlight = true;
        
        // Determine if the move was bad
        let isBadMove = false;
        const cellAtMove = targetBoard[currentActionedMove.y][currentActionedMove.x];
        const originalCellAtMove = trueMinedBoard[currentActionedMove.y]?.[currentActionedMove.x];


        if (currentActionedMove.action === 'reveal' && originalCellAtMove?.isMine) {
          isBadMove = true; // Clicked a mine
        } else if (currentActionedMove.action === 'flag' && !originalCellAtMove?.isMine) {
          isBadMove = true; // Flagged a non-mine
        }
        // Note: Unflagging a correctly flagged mine isn't inherently "bad" in the same way,
        // and unflagging a non-mine is generally good or neutral.

        targetBoard[currentActionedMove.y][currentActionedMove.x].isReplayHighlightBad = isBadMove;
      }
    }
    // if currentMoveIndex is -1, targetBoard is initial, targetTime is 0, no highlight.

    setReplayedBoardState(targetBoard);
    setReplayedTimeElapsed(targetTime);

  }, [game, currentMoveIndex]);

  // Effect to update board state when showBombs changes
  React.useEffect(() => {
    if (showBombs && game?.gameState && !nonJsonGameStates.includes(game.gameState)) {
      try {
       const trueMinedBoard = JSON.parse(game.gameState) as BoardState;
       const boardWithBombsRevealed = JSON.parse(JSON.stringify(trueMinedBoard)) as BoardState; // Deep copy
       boardWithBombsRevealed.forEach(row => row.forEach(cell => {
          cell.isRevealed = true;
          cell.exploded = false;
       }));
       setReplayedBoardState(boardWithBombsRevealed); // Update the state used by GameBoard
      } catch (e) {
        console.error("Error parsing game.gameState for bomb reveal:", e);
      }
    } else if (!showBombs && game) {
        // If showBombs is turned off, re-run the initial board state calculation effect
        // to revert to the state based on currentMoveIndex
        // This is a bit of a hack, ideally the main effect would handle both cases cleanly
        // but re-running it ensures the correct board state based on moves is restored.
        // A more robust solution would be to manage the board state derived from moves
        // and the 'showBombs' overlay state separately.
        const difficultySettings = Object.values(DIFFICULTY_LEVELS).find(
            (level) => level.name === game.difficulty
        );
        if (difficultySettings) {
             let targetBoard = createInitialBoard(difficultySettings.rows, difficultySettings.cols);
            if (game.gameState && !nonJsonGameStates.includes(game.gameState)) {
                 const trueMinedBoard = JSON.parse(game.gameState) as BoardState;
                 for (let r = 0; r < difficultySettings.rows; r++) {
                    for (let c = 0; c < difficultySettings.cols; c++) {
                        if (trueMinedBoard && trueMinedBoard[r] && trueMinedBoard[r][c]) {
                            targetBoard[r][c].isMine = trueMinedBoard[r][c].isMine;
                            targetBoard[r][c].adjacentMines = trueMinedBoard[r][c].adjacentMines;
                        }
                    }
                 }
                 targetBoard = calculateAdjacentMines(targetBoard, difficultySettings.rows, difficultySettings.cols);
            }

             if (currentMoveIndex >= 0 && game.moves && currentMoveIndex < game.moves.length) {
                // Replay moves up to currentMoveIndex again
                for (let i = 0; i <= currentMoveIndex; i++) {
                    const move = game.moves[i];
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
                     const trueMinedBoardForHighlight = JSON.parse(game.gameState) as BoardState;
                     let isBadMove = false;
                     const originalCellAtMove = trueMinedBoardForHighlight[currentActionedMove.y]?.[currentActionedMove.x];
                      if (currentActionedMove.action === 'reveal' && originalCellAtMove?.isMine) {
                         isBadMove = true;
                     } else if (currentActionedMove.action === 'flag' && !originalCellAtMove?.isMine) {
                         isBadMove = true;
                     }
                    targetBoard[currentActionedMove.y][currentActionedMove.x].isReplayHighlightBad = isBadMove;
                }
             }
             setReplayedBoardState(targetBoard);
        }
    }
  }, [showBombs, game, currentMoveIndex]); // Depend on showBombs, game, and currentMoveIndex

  return (
    <AppLayout>
      <div className="container mx-auto p-4 md:p-8">
            {/* PASTE THE BACK BUTTON CODE BLOCK HERE */}

            {game && ( // Only show back button if game data is loaded
              <div className="mb-4">
                {isOwnGame ? ( // If game belongs to logged-in user
                  <Button variant="outline" onClick={() => router.push('/history')}>
                    <ChevronLeft className="mr-2 h-4 w-4" /> Back to My History
                  </Button>
                ) : (
                  // If game belongs to another user (friend)
                  targetUserLoading ? (
                    <Skeleton className="h-10 w-40" />
                  ) : targetUserError ? (
                    <p className="text-destructive">Error loading user data for back button: {targetUserError.message}</p>
                  ) : ( // targetUserData is available (or undefined if not found, but we still render the button)
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
                    difficultyKey={game.difficulty.toLowerCase() as DifficultyKey}
                    initialBoardState={JSON.stringify(replayedBoardState)}
                    initialTimeElapsed={replayedTimeElapsed}
                    reviewMode={true}
                    isGuest={true} // Or determine based on actual game data if available
                    activeGameId={game.id}
                  />
                </div>
                  <div className="w-full flex justify-between items-center">
                      {/* "Show Bombs" button */}
                      <Button
                          onClick={() => setShowBombs(prev => !prev)}
                          variant={showBombs ? "secondary" : "outline"}
                      >{showBombs ? "Hide Bombs" : "Show Bombs"}</Button>
                      {/* "Continue from this point" button */}
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
                            try {
                              const newGameRef = await addDoc(collection(firestore, "games"), {
                                difficulty: game.difficulty,
                                endTime: serverTimestamp(),
                                gameState: JSON.stringify(replayedBoardState),
                                moves: [],
                                result: 'in-progress',
                                startTime: serverTimestamp(),
                                userId: game.userId,
                              });
                              router.push(`/history`);
                            } catch (e) {
                              console.error("Error creating new game document:", e);
                            }
                          }}
                          variant={showBombs ? "destructive" : "outline"}
                          disabled={showBombs}>Continue from this point</Button>
                  </div>
                

                {game.moves && game.moves.length > 0 && (
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

            {game.moves && game.moves.length === 0 && (
               <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Replay Available</AlertTitle>
                <AlertDescription>
                  No moves were recorded for this game. The final board state (if available) is shown.
                </AlertDescription>
              </Alert>
            )}
             {!replayedBoardState && game.moves && game.moves.length > 0 && (
               <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Loading Replay</AlertTitle>
                <AlertDescription>
                  Board state is currently being reconstructed for replay.
                </AlertDescription>
              </Alert>
            )}

            
          {/*  
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="game-details">
                <AccordionTrigger>Game Details</AccordionTrigger>
                <AccordionContent className="space-y-2 pt-2">
                  <p><span className="font-semibold">Game ID:</span> {game.id}</p>
                  <p><span className="font-semibold">Difficulty:</span> {game.difficulty}</p>
                  <p><span className="font-semibold">Final Result:</span> {game.result}</p>
                  {game.startTime && (
                    <p><span className="font-semibold">Started:</span> {new Date(game.startTime.toDate()).toLocaleString()}</p>
                  )}
                  {game.endTime && (
                    <p><span className="font-semibold">Ended:</span> {new Date(game.endTime.toDate()).toLocaleString()}</p>
                  )}
                  {(game.result === 'won' || game.result === 'lost' || game.result === 'quit') ? (
                    game.endTime && game.startTime ? (
                      <p><span className="font-semibold">Duration:</span> {Math.round((game.endTime.toDate().getTime() - game.startTime.toDate().getTime()) / 1000)} seconds</p>
                    ) : null
                  ) : null}
                  <p><span className="font-semibold">Total Moves:</span> {game.moves?.length || 0}</p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          */}

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
    <Suspense fallback={<div>Loading game review...</div>}><GameReviewContent /></Suspense>
  );
}

