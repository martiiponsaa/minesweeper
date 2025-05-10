'use client';
 import AppLayout from '@/components/layout/AppLayout';
 import { Button } from '@/components/ui/button';
 import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
 import { useRouter } from 'next/navigation';
 import { useAuth } from '@/hooks/useAuth';
 import { History, CheckCircle2, XCircle, Hourglass, PauseCircle, Trash2, Play, Eye } from 'lucide-react'; 
 import { useFirestoreCollection } from '@/hooks/useFirestoreCollection';
 import { GameSchema, type Game } from '@/lib/firebaseTypes';
 import { collection, query, where, orderBy, limit, writeBatch, getDocs, doc, deleteDoc } from 'firebase/firestore'; 
 import { getFirebase } from '@/firebase';
 import { Skeleton } from '@/components/ui/skeleton';
 import { Badge } from '@/components/ui/badge';
 import { formatDistanceToNow } from 'date-fns';
 import { useToast } from '@/hooks/use-toast'; 
 import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import React from 'react';


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
  return <Badge variant={variant} className={result === 'won' ? 'bg-green-500 hover:bg-green-600 text-white' : (result === 'in-progress' ? 'bg-yellow-500 text-black hover:bg-yellow-600' : '') }>{text}</Badge>;
};


 export default function HistoryPage() {
    const router = useRouter();
    const { user } = useAuth();
    const { firestore } = getFirebase();
    const { toast } = useToast(); 
    const [isClearing, setIsClearing] = React.useState(false);
    const [isDeleting, setIsDeleting] = React.useState<string | null>(null); 

    const gameConstraints = user ? [
        where('userId', '==', user.uid),
        orderBy('startTime', 'desc'), 
    ] : [];

    const { data: games, loading: gamesLoading, error: gamesError, refetch: refetchGames } = useFirestoreCollection<Game>(
        'games', 
        GameSchema,
        gameConstraints,
        !user 
    );
    

    const handlePlayOrViewGame = (game: Game) => {
      if (game.result === 'in-progress') {
        router.push('/play'); 
      } else if (game.result === 'won' || game.result === 'lost') {
        router.push(`/history/game-review?gameId=${game.id}`);
      } else if (game.result === 'quit') {
         toast({ title: "Game Quit", description: "This game was quit and cannot be reviewed in detail."});
      }
    };
    
    const handleDeleteGame = async (gameId: string) => {
        if (!user || !firestore) {
            toast({ title: "Error", description: "Cannot delete game.", variant: "destructive" });
            return;
        }
        setIsDeleting(gameId);
        try {
            const gameDocRef = doc(firestore, 'games', gameId);
            await deleteDoc(gameDocRef);
            toast({ title: "Game Deleted", description: "The game has been removed from your history." });
            refetchGames(); 
        } catch (error) {
            console.error("Error deleting game:", error);
            toast({ title: "Delete Failed", description: "Could not delete the game.", variant: "destructive" });
        } finally {
            setIsDeleting(null);
        }
    };


    const handleClearHistory = async () => {
      if (!user || !firestore) {
        toast({ title: "Error", description: "Cannot clear history.", variant: "destructive" });
        return;
      }
      setIsClearing(true);
      try {
        const gamesCollectionRef = collection(firestore, 'games');
        const q = query(gamesCollectionRef, where('userId', '==', user.uid));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            toast({ title: "No History", description: "There is no game history to clear." });
            setIsClearing(false);
            return;
        }

        const batch = writeBatch(firestore);
        querySnapshot.forEach((doc) => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        toast({ title: "History Cleared", description: "Your game history has been successfully deleted." });
        refetchGames(); 
      } catch (error: any) {
        console.error("Error clearing history:", error);
        let description = "Could not clear your game history. Please try again.";
        if (error.message?.includes("firestore/permission-denied")) {
            description = "Permission denied. You might not have the rights to delete this data.";
        } else if (error.message?.includes("The query requires an index")) {
             description = "A Firestore index might be missing. Contact support if this persists.";
        }
        toast({ title: "Clear History Failed", description, variant: "destructive" });
      } finally {
        setIsClearing(false);
      }
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
            <div className="flex justify-between items-center mb-8">
             <h1 className="text-3xl font-bold text-foreground">Match History</h1>
             {games && games.length > 0 && (
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" disabled={isClearing || isDeleting !== null}>
                            <Trash2 className="mr-2 h-4 w-4" /> {isClearing ? "Clearing..." : "Clear All History"}
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete ALL your game history.
                        </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleClearHistory} className="bg-destructive hover:bg-destructive/90">
                            Yes, clear all history
                        </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
             )}
            </div>
             <Card>
                 <CardHeader>
                     <CardTitle>Your Games</CardTitle>
                     <CardDescription>Review details of your past and ongoing Minesweeper games.</CardDescription>
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
                                    <Skeleton className="h-8 w-32" /> 
                                </div>
                            ))}
                        </div>
                    )}
                    {!gamesLoading && gamesError && (
                        <div className="text-center text-red-500 py-10">
                            <p className="font-semibold">Error loading game history:</p>
                            <p className="mb-2">{gamesError.message}</p>
                            {(gamesError as any)?.code === 'failed-precondition' && (gamesError.message.includes("The query requires an index") || gamesError.message.includes("requires an index")) && (
                                <p className="text-sm text-muted-foreground">
                                    A Firestore index is needed for this query. If you are the developer, 
                                    you can create it in your Firebase console under Firestore Database &gt; Indexes.
                                    <br />Collection: <strong>games</strong>
                                    <br />Fields: <strong>userId</strong> (Ascending), <strong>startTime</strong> (Descending)
                                </p>
                            )}
                             {!( (gamesError as any)?.code === 'failed-precondition' && (gamesError.message.includes("The query requires an index") || gamesError.message.includes("requires an index"))) && (
                                 <p className="text-sm text-muted-foreground">Please try again later or contact support if the issue persists.</p>
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
                                                {game.difficulty} - 
                                                {game.result === 'won' || game.result === 'lost' 
                                                    ? game.endTime && game.startTime ? `${Math.round((game.endTime.toDate().getTime() - game.startTime.toDate().getTime()) / 1000)}s` : 'N/A'
                                                    : (game.result === 'in-progress' ? 'In Progress' : (game.result === 'quit' ? 'Quit' : 'N/A'))
                                                }
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {formatDistanceToNow(game.startTime.toDate(), { addSuffix: true })}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                                      <GameResultBadge result={game.result} />
                                      <Button 
                                          variant="outline" 
                                          size="sm" 
                                          onClick={() => handlePlayOrViewGame(game)}
                                          disabled={isDeleting === game.id || isClearing}
                                          title={
                                            game.result === 'in-progress' ? "Continue this game" :
                                            (game.result === 'quit' ? "Game was quit" : "Review Game")
                                          }
                                      >
                                          {game.result === 'in-progress' ? <Play className="mr-1 h-4 w-4" /> : <Eye className="mr-1 h-4 w-4" /> }
                                          {game.result === 'in-progress' ? 'Continue' : (game.result === 'quit' ? 'Details' : 'Review')}
                                      </Button>
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button 
                                                variant="destructive" 
                                                size="sm" 
                                                disabled={isDeleting === game.id || isClearing}
                                                title="Delete this game entry"
                                            >
                                                {isDeleting === game.id ? <Hourglass className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                            <AlertDialogTitle>Delete this game?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This action cannot be undone. This will permanently delete this game entry from your history.
                                            </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                            <AlertDialogCancel disabled={isDeleting === game.id}>Cancel</AlertDialogCancel>
                                            <AlertDialogAction 
                                                onClick={() => handleDeleteGame(game.id)} 
                                                className="bg-destructive hover:bg-destructive/90"
                                                disabled={isDeleting === game.id}
                                            >
                                                {isDeleting === game.id ? "Deleting..." : "Yes, delete game"}
                                            </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                 </CardContent>
                 {games && games.length > 0 && !gamesLoading && !gamesError && (
                    <CardFooter className="justify-center">
                        <p className="text-sm text-muted-foreground">Showing {games.length} game{games.length === 1 ? '' : 's'}.</p>
                    </CardFooter>
                 )}
             </Card>
           </>
         )}
       </div>
     </AppLayout>
   );
 }
