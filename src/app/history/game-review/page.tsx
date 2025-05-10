'use client';

import { useFirestoreDocument } from '@/hooks/useFirestoreDocument';
import { GameSchema, type Game } from '@/lib/firebaseTypes';
import type { BoardState } from '@/lib/minesweeper';
import { createInitialBoard, revealCell, toggleFlag } from '@/lib/minesweeper';
import { DIFFICULTY_LEVELS, type DifficultyKey } from '@/config/minesweeperSettings';
import { useSearchParams } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout'; // Import AppLayout
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import React from 'react';
import GameBoard from '@/components/minesweeper/GameBoard'; // Import GameBoard
import { Button } from '@/components/ui/button'; // Import Button for controls
import Link from 'next/link'; // Import Link
import { ChevronLeft, ChevronRight } from 'lucide-react'; // Import icons

export default function GameReviewPage() {
  const searchParams = useSearchParams();
  const gameId = searchParams.get('gameId');

  const { data: game, loading, error } = useFirestoreDocument<Game>(
 'games',
    gameId,
    GameSchema
    );

  const [currentMoveIndex, setCurrentMoveIndex] = React.useState<number>(-1);
  const [replayedBoardState, setReplayedBoardState] = React.useState<BoardState | null>(null);

  React.useEffect(() => {
    if (game?.difficulty && game.moves) {
      const difficultySettings = Object.values(DIFFICULTY_LEVELS).find(
        (level) => level.name === game.difficulty
      );

      if (!difficultySettings) {
        console.error(`Unknown difficulty: ${game.difficulty}`);
        setReplayedBoardState(null);
        return;
      }

 let board: BoardState = createInitialBoard(
        difficultySettings.rows,
        difficultySettings.cols
      );

      // Apply moves up to the currentMoveIndex
      for (let i = 0; i <= currentMoveIndex && game.moves && i < game.moves.length; i++) {
        const move = game.moves[i];
        if (move.action === 'reveal') {
          // Assuming revealCell handles first click logic internally or we don't need it for replay
 const result = revealCell(board, difficultySettings.rows, difficultySettings.cols, move.x, move.y);
           board = result.newBoard;
        } else if (move.action === 'flag' || move.action === 'unflag') {
 board = toggleFlag(board, move.x, move.y);
        }
      }
 setReplayedBoardState(board);
    } else {
      setReplayedBoardState(null);
    }
  }, [game, currentMoveIndex]);

  return (
    <AppLayout>
      <div className="container mx-auto p-4 md:p-8">
        <div className="mb-4">
          <Button variant="outline" asChild><Link href="/history"><ChevronLeft className="mr-2 h-4 w-4" />Back to History</Link></Button>
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-8">Game Review</h1>

        {loading && (
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-[100px] w-full" />
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
              <CardTitle>Game Details</CardTitle>
              <CardDescription>Review the details of this completed game.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
              {/* More game details can be added here */}
            </CardContent>

            {(!game.moves || game.moves.length === 0) ? (
              <CardContent>
                No moves recorded for this game.
              </CardContent>
            ) : (
              <>
                <CardHeader>
                  <CardTitle>Replay Controls</CardTitle>
                  <CardDescription>Step through the game moves.</CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center items-center space-x-4">
                  <Button
                    onClick={() => setCurrentMoveIndex(prev => Math.max(-1, prev - 1))}
                    disabled={currentMoveIndex <= -1}
 >
                    <ChevronLeft className="mr-2 h-4 w-4" /> Previous Move
                  </Button>
                  <span>Move {currentMoveIndex + 1} of {game.moves ? game.moves.length : 0}</span>
                  <Button
                    onClick={() => setCurrentMoveIndex(prev => Math.min(game.moves.length - 1, prev + 1))}
                    disabled={currentMoveIndex >= game.moves.length - 1}
 >
                    Next Move <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
                <CardContent className="p-0 sm:p-2 md:p-4">
 {replayedBoardState && (
 <GameBoard
                            difficultyKey={game.difficulty.toLowerCase() as DifficultyKey}
                            initialBoardState={JSON.stringify(replayedBoardState)}
                            reviewMode={true}
 isGuest={true}
                            activeGameId={game.id}
                        />
                    )}
                </CardContent>
              </>
            )}
          </Card>
        )}
      </div>
    </AppLayout>
  );
}