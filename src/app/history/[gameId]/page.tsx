
'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { useFirestoreDocument } from '@/hooks/useFirestoreDocument';
import { GameSchema, type Game } from '@/lib/firebaseTypes';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import GameBoard from '@/components/minesweeper/GameBoard';
import { DIFFICULTY_LEVELS, type DifficultyKey } from '@/config/minesweeperSettings';
import { ArrowLeft, AlertCircle, CheckCircle2, XCircle, Hourglass, PauseCircle, History as HistoryIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';

// Removed generateStaticParams as it's not compatible with "use client"
// export async function generateStaticParams() {
//   // This function should return an array of params for which static pages will be generated at build time.
//   // For now, we return an empty array, meaning no game review pages are pre-rendered.
//   // They will be client-side rendered when accessed.
//   // In a production scenario, you might fetch popular or recent game IDs here.
//   return [];
// }

const GameResultIcon = ({ result }: { result: Game['result'] }) => {
  switch (result) {
    case 'won':
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    case 'lost':
      return <XCircle className="h-5 w-5 text-red-500" />;
    case 'in-progress':
      return <Hourglass className="h-5 w-5 text-yellow-500" />;
    case 'quit':
      return <PauseCircle className="h-5 w-5 text-orange-500" />;
    default:
      return <HistoryIcon className="h-5 w-5 text-muted-foreground" />;
  }
};

const GameResultTextBadge = ({ result }: { result: Game['result'] }) => {
  let variant: "default" | "secondary" | "destructive" | "outline" = "default";
  let text = result ? result.charAt(0).toUpperCase() + result.slice(1) : "Unknown";

  switch (result) {
    case 'won':
      variant = "default"; 
      text = "Victory";
      break;
    case 'lost':
      variant = "destructive";
      text = "Defeat";
      break;
    case 'in-progress':
      variant = "secondary"; 
      text = "In Progress";
      break;
    case 'quit':
      variant = "outline";
      text = "Quit";
      break;
  }
  return <Badge variant={variant} className={`capitalize ${result === 'won' ? 'bg-green-500 hover:bg-green-600 text-white' : (result === 'in-progress' ? 'bg-yellow-500 text-black hover:bg-yellow-600' : '') }`}>{text}</Badge>;
};


export default function GameReviewPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const gameId = typeof params.gameId === 'string' ? params.gameId : undefined;

  const { data: game, loading: gameLoading, error: gameError } = useFirestoreDocument<Game>(
    'games',
    gameId,
    GameSchema
  );

  if (gameLoading) {
    return (
      <AppLayout>
        <div className="container mx-auto p-4 md:p-8">
          <Skeleton className="h-10 w-1/3 mb-4" />
          <Skeleton className="h-8 w-1/4 mb-8" />
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-1/2" />
              <Skeleton className="h-4 w-3/4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
            <CardFooter>
              <Skeleton className="h-10 w-24" />
            </CardFooter>
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (gameError || !game) {
    return (
      <AppLayout>
        <div className="container mx-auto p-4 md:p-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <AlertCircle className="mr-2 h-6 w-6 text-destructive" />
                Error Loading Game
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-destructive">
                {gameError ? `Failed to load game data: ${gameError.message}` : 'Game not found or you do not have permission to view it.'}
              </p>
            </CardContent>
            <CardFooter>
              <Button onClick={() => router.push('/history')}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to History
              </Button>
            </CardFooter>
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (game.userId !== user?.uid && user) {
     return (
      <AppLayout>
        <div className="container mx-auto p-4 md:p-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <AlertCircle className="mr-2 h-6 w-6 text-destructive" />
                Access Denied
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p>You do not have permission to view this game.</p>
            </CardContent>
            <CardFooter>
              <Button onClick={() => router.push('/history')}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to History
              </Button>
            </CardFooter>
          </Card>
        </div>
      </AppLayout>
    );
  }
  
  if (game.result === 'in-progress' || game.result === 'quit') {
     return (
      <AppLayout>
        <div className="container mx-auto p-4 md:p-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <HistoryIcon className="mr-2 h-6 w-6 text-muted-foreground" />
                Game Not Completed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p>This game is currently '{game.result}' and cannot be reviewed yet. You can continue or quit it from the Play page or History page.</p>
            </CardContent>
            <CardFooter>
              <Button onClick={() => router.push('/history')}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to History
              </Button>
            </CardFooter>
          </Card>
        </div>
      </AppLayout>
    );
  }


  const difficultyKey = Object.keys(DIFFICULTY_LEVELS).find(
    key => DIFFICULTY_LEVELS[key as DifficultyKey].name === game.difficulty
  ) as DifficultyKey | undefined;

  const gameDuration = game.endTime && game.startTime
    ? Math.round((game.endTime.toDate().getTime() - game.startTime.toDate().getTime()) / 1000)
    : null;

  return (
    <AppLayout>
      <div className="container mx-auto p-4 md:p-8">
        <Button onClick={() => router.push('/history')} variant="outline" className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to History
        </Button>
        <h1 className="text-3xl font-bold text-foreground mb-2">Game Review</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Played {formatDistanceToNow(game.startTime.toDate(), { addSuffix: true })}
        </p>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Game Details - {game.difficulty}</CardTitle>
              <GameResultTextBadge result={game.result} />
            </div>
            <CardDescription>
              Result: <span className="font-semibold">{game.result ? game.result.charAt(0).toUpperCase() + game.result.slice(1) : 'N/A'}</span>
              {gameDuration !== null && ` in ${gameDuration} seconds.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {difficultyKey && game.gameState ? (
              <GameBoard
                difficultyKey={difficultyKey}
                initialBoardState={game.gameState}
                isGuest={!user} // Guest status doesn't really matter for review
                reviewMode={true}
                initialTimeElapsed={gameDuration ?? 0} // Pass final time for display
              />
            ) : (
              <p className="text-muted-foreground text-center py-10">
                Could not load game board. Difficulty settings or game state might be missing.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
