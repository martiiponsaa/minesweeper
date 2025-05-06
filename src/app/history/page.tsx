
'use client';
 import AppLayout from '@/components/layout/AppLayout';
 import { Button } from '@/components/ui/button';
 import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
 import { useRouter } from 'next/navigation';
 import { useAuth } from '@/hooks/useAuth';
 import { History, CheckCircle2, XCircle, Hourglass, PauseCircle } from 'lucide-react';
 import { useFirestoreCollection } from '@/hooks/useFirestoreCollection';
 import { GameSchema, type Game } from '@/lib/firebaseTypes';
 import { collection, query, where, orderBy, limit } from 'firebase/firestore';
 import { getFirebase } from '@/firebase';
 import { Skeleton } from '@/components/ui/skeleton';
 import { Badge } from '@/components/ui/badge';
 import { formatDistanceToNow } from 'date-fns';
 import { useToast } from '@/hooks/use-toast'; 


 const GameStatusIcon = ({ result }: { result: Game['result'] }) => {
   switch (result) {
     case 'won':
       return <CheckCircle2 className="h-5 w-5 text-green-500" />;
     case 'lost':
       return <XCircle className="h-5 w-5 text-red-500" />;
     case 'in-progress':
       return <Hourglass className="h-5 w-5 text-yellow-500 animate-spin" />;
     case 'quit':
       return <PauseCircle className="h-5 w-5 text-orange-500" />;
     default:
       return <History className="h-5 w-5 text-muted-foreground" />;
   }
 };

 const GameResultBadge = ({ result }: { result: Game['result'] }) => {
  let variant: "default" | "secondary" | "destructive" | "outline" = "default";
  let text = result ? result.charAt(0).toUpperCase() + result.slice(1) : "Unknown";

  switch (result) {
    case 'won':
      variant = "default"; // Using primary for win
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
  return <Badge variant={variant}>{text}</Badge>;
};


 export default function HistoryPage() {
    const router = useRouter();
    const { user } = useAuth();
    const { firestore } = getFirebase();
    const { toast } = useToast(); 

    const gameConstraints = user ? [
        where('userId', '==', user.uid),
        orderBy('startTime', 'desc'),
        limit(20) // Get last 20 games
    ] : [];

    const { data: games, loading: gamesLoading, error: gamesError } = useFirestoreCollection<Game>(
        'games', // Collection path
        GameSchema,
        gameConstraints
    );
    

    const handleViewGame = (gameId: string) => {
      // TODO: Implement a page or modal to view detailed game state/replay
      toast({ title: "Coming Soon", description: "Game replay functionality is not yet implemented."});
    };


   return (
     <AppLayout>
       <div className="container mx-auto p-4 md:p-8">
         {!user ? ( 
           <div className="flex flex-col items-center justify-center text-center">
             <History className="h-16 w-16 text-muted-foreground mb-4" />
             <h1 className="text-2xl font-bold text-foreground mb-3">View Your Game History</h1>
             <p className="text-muted-foreground mb-6 max-w-md">
               To save and review your past games, including replays and performance details, please create an account or log in. Guest gameplay is not saved.
             </p>
             <Button onClick={() => router.push('/register')}>
               Register or Login
             </Button>
           </div>
         ) : (
           <>
             <h1 className="text-3xl font-bold text-foreground mb-8">Match History</h1>
             <Card>
                 <CardHeader>
                     <CardTitle>Your Recent Games</CardTitle>
                     <CardDescription>Review details of your past Minesweeper games.</CardDescription>
                 </CardHeader>
                 <CardContent>
                    {gamesLoading && (
                        <div className="space-y-4">
                            {[...Array(3)].map((_, i) => (
                                <div key={i} className="flex items-center justify-between p-4 border-b">
                                    <div className="flex items-center gap-3">
                                        <Skeleton className="h-6 w-6 rounded-full" />
                                        <div className="space-y-1">
                                            <Skeleton className="h-4 w-32" />
                                            <Skeleton className="h-3 w-24" />
                                        </div>
                                    </div>
                                    <Skeleton className="h-6 w-20" />
                                    <Skeleton className="h-8 w-24" />
                                </div>
                            ))}
                        </div>
                    )}
                    {!gamesLoading && gamesError && (
                        <div className="text-center text-red-500 py-10">
                            <p className="font-semibold">Error loading game history:</p>
                            <p className="mb-2">{gamesError.message}</p>
                            {gamesError.message.includes("The query requires an index") && (
                                <p className="text-sm text-muted-foreground">
                                    A Firestore index is needed for this query. If you're an administrator, 
                                    you can create it in your Firebase console under Firestore Database &gt; Indexes.
                                    The required index is for the 'games' collection, with fields: 
                                    'userId' (ascending) and 'startTime' (descending).
                                </p>
                            )}
                        </div>
                    )}
                    {!gamesLoading && !gamesError && games.length === 0 && (
                         <div className="text-center text-muted-foreground py-10">
                             <p>Your game history is empty.</p>
                             <p className="mt-2">Play some games to see your history!</p>
                             <Button className="mt-4" onClick={() => router.push('/play')}>Play Now</Button>
                         </div>
                    )}
                    {!gamesLoading && !gamesError && games.length > 0 && (
                        <ul className="divide-y divide-border">
                            {games.map((game) => (
                                <li key={game.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 hover:bg-muted/50 transition-colors">
                                    <div className="flex items-center gap-3 mb-2 sm:mb-0">
                                        <GameStatusIcon result={game.result} />
                                        <div>
                                            <p className="font-semibold text-foreground">
                                                {game.difficulty} - {game.result === 'won' || game.result === 'lost' ? `${(game.endTime!.toDate().getTime() - game.startTime.toDate().getTime()) / 1000}s` : (game.result === 'in-progress' ? 'Ongoing' : 'N/A')}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {formatDistanceToNow(game.startTime.toDate(), { addSuffix: true })}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                                      <GameResultBadge result={game.result} />
                                      <Button 
                                          variant="outline" 
                                          size="sm" 
                                          onClick={() => handleViewGame(game.id)}
                                          disabled={game.result === 'in-progress' || game.result === 'quit'} // Allow loading saved games later
                                          title={game.result === 'in-progress' ? "Game is still in progress" : (game.result === 'quit' ? "Game was quit" : "View Game Details")}
                                      >
                                          {game.result === 'in-progress' ? 'Continue' : 'Details'}
                                      </Button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                 </CardContent>
                 {games.length > 0 && (
                    <CardFooter className="justify-center">
                        <p className="text-sm text-muted-foreground">Showing last {games.length} games.</p>
                    </CardFooter>
                 )}
             </Card>
           </>
         )}
       </div>
     </AppLayout>
   );
 }
