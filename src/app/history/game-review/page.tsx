// src/app/history/game-review/page.tsx
'use client';

import { useFirestoreDocument } from '@/hooks/useFirestoreDocument';
import { GameSchema, type Game } from '@/lib/firebaseTypes';
import type { BoardState } from '@/lib/minesweeper';
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const nonJsonGameStates = [
  "INITIAL_BOARD_STATE",
  "QUIT_FOR_NEW_GAME",
  "QUIT_ON_RESTART",
  "QUIT_ON_DIFFICULTY_CHANGE",
  "QUIT_STATE_UNKNOWN",
  "AUTO_QUIT_MULTIPLE_IN_PROGRESS",
];

export default function GameReviewPage() {
  const searchParams = useSearchParams();
  const gameId = searchParams.get('gameId');

  const { data: game, loading, error } = useFirestoreDocument<Game>(
    'games',
    gameId,
    GameSchema
  );

  const [currentMoveIndex, setCurrentMoveIndex] = React.useState<number>(0);
  const [replayedBoardState, setReplayedBoardState] = React.useState<BoardState | null>(null);
  const [replayedTimeElapsed, setReplayedTimeElapsed] = React.useState<number>(0);

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

    // Case 1: No moves to replay
    if (!game.moves || game.moves.length === 0) {
      if (game.gameState && !nonJsonGameStates.includes(game.gameState)) {
        try {
          targetBoard = JSON.parse(game.gameState) as BoardState;
          // Ensure adjacency counts are present, re-calculate if necessary (though unlikely for final states)
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
    // Step 1: Get the true mine locations and adjacency counts from the game's final state.
    let trueMinedBoard: BoardState | null = null;
    if (game.gameState && !nonJsonGameStates.includes(game.gameState)) {
      try {
        trueMinedBoard = JSON.parse(game.gameState) as BoardState;
      } catch (e) {
        console.error("Error parsing game.gameState for replay:", e);
        setReplayedBoardState(createInitialBoard(difficultySettings.rows, difficultySettings.cols)); // Fallback
        return;
      }
    } else {
      console.error("Cannot replay: game.gameState is not a valid board JSON for sourcing mine locations.");
      setReplayedBoardState(createInitialBoard(difficultySettings.rows, difficultySettings.cols)); // Fallback
      return;
    }

    // Step 2: Create a fresh board, unrevealed, but with correct mine data and adjacentMines counts.
    targetBoard = createInitialBoard(difficultySettings.rows, difficultySettings.cols);
    for (let r = 0; r < difficultySettings.rows; r++) {
      for (let c = 0; c < difficultySettings.cols; c++) {
        if (trueMinedBoard && trueMinedBoard[r] && trueMinedBoard[r][c]) {
          targetBoard[r][c].isMine = trueMinedBoard[r][c].isMine;
          targetBoard[r][c].adjacentMines = trueMinedBoard[r][c].adjacentMines;
        } else {
          // This case should ideally not happen if trueMinedBoard is valid and matches difficulty
          console.warn(`Missing cell data in trueMinedBoard at ${r},${c}`);
        }
      }
    }

    // Step 3: Apply moves up to currentMoveIndex
    const effectiveMoveIndex = Math.min(currentMoveIndex, game.moves.length - 1);

    for (let i = 0; i <= effectiveMoveIndex; i++) {
      const move = game.moves[i];
      if (move.action === 'reveal') {
        const result = revealCell(targetBoard, difficultySettings.rows, difficultySettings.cols, move.x, move.y);
        targetBoard = result.newBoard;
        if (result.gameOver) {
          // If this specific move caused game over, mark it as exploded
          if (i === effectiveMoveIndex && targetBoard[move.y][move.x].isMine) {
            targetBoard[move.y][move.x].exploded = true;
          }
          // For review, we might want to continue applying subsequent flag moves, so don't break
        }
      } else if (move.action === 'flag' || move.action === 'unflag') {
        targetBoard = toggleFlag(targetBoard, move.x, move.y);
      }
      // Update time based on this move's timestamp
      if (move.timestamp && game.startTime) {
        targetTime = Math.round((move.timestamp.toDate().getTime() - game.startTime.toDate().getTime()) / 1000);
      }
    }
     // If currentMoveIndex is -1 (before first move), targetTime should be 0.
    // The loop for (let i=0; i <= effectiveMoveIndex) won't run if effectiveMoveIndex is -1.
    // So targetTime remains 0, which is correct.
    // If effectiveMoveIndex is >= 0, targetTime is set by the last move in the loop.

    setReplayedBoardState(targetBoard);
    setReplayedTimeElapsed(targetTime);

  }, [game, currentMoveIndex]);

  return (
    <AppLayout>
      <div className="container mx-auto p-4 md:p-8">
        <div className="mb-4">
          <Button variant="outline" asChild>
            <Link href="/history">
              <ChevronLeft className="mr-2 h-4 w-4" />Back to History
            </Link>
          </Button>
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-8">Game Review</h1>

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
                      currentBoardState={JSON.stringify(replayedBoardState)}
                      initialTimeElapsed={replayedTimeElapsed}
                      reviewMode={true}
                      isGuest={true} 
                      activeGameId={game.id}
                    />
                  </div>

                  {game.moves && game.moves.length > 0 && (
                    <div className="flex justify-center items-center space-x-4">
                      <Button
                        onClick={() => setCurrentMoveIndex(prev => Math.max(0, prev - 1))}
                        disabled={currentMoveIndex <= 0}
                        variant="outline"
                      >
                        <ChevronLeft className="mr-2 h-4 w-4" /> Previous
                      </Button>
                      <span className="text-sm text-muted-foreground tabular-nums w-40 text-center">
                        Move: {`${currentMoveIndex + 1} / ${game.moves.length}`}\
                      </span>
                      <Button
                        onClick={() => setCurrentMoveIndex(prev => Math.min(game.moves.length - 1, prev + 1))}
                        disabled={currentMoveIndex >= game.moves.length - 1}
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
               {!replayedBoardState && (!game.moves || game.moves.length > 0) && (
                 <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Loading Replay</AlertTitle>
                  <AlertDescription>
                    Board state is currently being reconstructed for replay.
                  </AlertDescription>
                </Alert>
              )}


              <Accordion type="single" collapsible className="w-full" defaultValue='game-details'>
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
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
