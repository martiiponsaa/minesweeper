'use client';
 import AppLayout from '@/components/layout/AppLayout';
 import { Button } from '@/components/ui/button';
 import { Card, CardContent, CardHeader, CardTitle, CardDescription} from '@/components/ui/card';
 import { useRouter } from 'next/navigation';
 import { useAuth } from '@/hooks/useAuth';
 import { History } from 'lucide-react'; // Import an icon

 export default function HistoryPage() {
    const router = useRouter();
    const { user } = useAuth();

   return (
     <AppLayout>
       <div className="container mx-auto p-4 md:p-8">
         {!user ? ( // Check if user is a guest (null)
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
           // Original content for logged-in users
           <>
             <h1 className="text-3xl font-bold text-foreground mb-8">Match History</h1>
             <Card>
                 <CardHeader>
                     <CardTitle>Your Games</CardTitle>
                     <CardDescription>Review details and replays of your past Minesweeper games.</CardDescription>
                 </CardHeader>
                 <CardContent>
                     {/* Placeholder content */}
                     <div className="text-center text-muted-foreground py-10">
                         <p>Your game history will appear here.</p>
                         <p className="mt-2">Play some games to see your history!</p>
                         <Button className="mt-4" onClick={() => router.push('/play')}>Play Now</Button>
                     </div>
                     {/* TODO: Implement fetching and displaying game history list */}
                 </CardContent>
             </Card>
           </>
         )}
       </div>
     </AppLayout>
   );
 }
