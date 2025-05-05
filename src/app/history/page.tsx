'use client';
 import AppLayout from '@/components/layout/AppLayout';
 import { Button } from '@/components/ui/button';
 import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
 import { useRouter } from 'next/navigation';
 import { AuthCheck } from '@/components/auth/AuthCheck'; // Import AuthCheck

 export default function HistoryPage() {
    const router = useRouter();
   return (
     // Wrap with AuthCheck
     <AuthCheck redirectTo="/login">
        <AppLayout>
          <div className="container mx-auto p-4 md:p-8">
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
          </div>
        </AppLayout>
      </AuthCheck>
   );
 }
