// src/app/dashboard/page.tsx
'use client';

import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useFirestoreCollection } from '@/hooks/useFirestoreCollection';
import { GameSchema, type Game } from '@/lib/firebaseTypes';
import { collection, query, where, orderBy } from 'firebase/firestore'; // Added for query
import { getFirebase } from '@/firebase'; // Added for firestore instance

interface SummaryStats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { firestore } = getFirebase(); // Get firestore instance

  // Fetch game data for the logged-in user
  const { data: games, loading: gamesLoading, error: gamesError } = useFirestoreCollection<Game>(
    'games',
    GameSchema,
    user ? [where('userId', '==', user.uid), orderBy('startTime', 'desc')] : [],
    !user // Disable if no user
  );

  const calculateSummaryStats = (): SummaryStats => {
    if (!games || games.length === 0) {
      return { gamesPlayed: 0, wins: 0, losses: 0, winRate: 0 };
    }

    let wins = 0;
    let losses = 0;

    games.forEach(game => {
      if (game.result === 'won') {
        wins++;
      } else if (game.result === 'lost') {
        losses++;
      }
    });

    const gamesPlayed = games.length; // Count all games fetched for the user
    const winRate = (wins + losses) > 0 ? parseFloat((wins / (wins + losses)).toFixed(2)) : 0;

    return { gamesPlayed, wins, losses, winRate };
  };

  const summaryStats = user ? calculateSummaryStats() : null;

  return (
    <AppLayout>
      <div className="container mx-auto p-4 md:p-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-foreground">
            Welcome, {user?.displayName || user?.email || 'Guest'}!
          </h1>
           {user ? (
             // Add the handleSignOut function within DashboardPageContent
             (() => {
               const { signOut } = useAuth(); // Get signOut from useAuth
               const handleSignOut = async () => { await signOut(); router.push('/'); }; // Define handleSignOut
               return <Button onClick={handleSignOut} variant="outline">Logout</Button>;
             })()
           ) : (
             <Button onClick={() => router.push('/login')} variant="outline">Login</Button>
           )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="bg-card p-6 rounded-lg shadow-md">
            <CardHeader className="p-0 mb-4">
              <CardTitle className="text-xl font-semibold text-card-foreground">Play MineVerse</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <p className="text-muted-foreground mb-4">Start a new game or continue your last one.</p>
              <Button className="w-full bg-primary hover:bg-primary/90" onClick={() => router.push('/play')}>New Game</Button>
            </CardContent>
          </Card>

          <Card className="bg-card p-6 rounded-lg shadow-md">
            <CardHeader className="p-0 mb-4">
              <CardTitle className="text-xl font-semibold text-card-foreground">Match History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <p className="text-muted-foreground mb-4">
                {user ? "Review your past games and performance." : "Register to save and review your game history."}
              </p>
              <Button className={`w-full ${user ? 'bg-primary hover:bg-primary/90' : ''}`} variant={user ? 'default' : 'secondary'} onClick={() => router.push(user ? `/history?id=${user.uid}` : '/register')} disabled={!user}>
                {user ? "View History" : "Register to View History"}
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-card p-6 rounded-lg shadow-md">
             <CardHeader className="p-0 mb-4">
               <CardTitle className="text-xl font-semibold text-card-foreground">Friends</CardTitle>
             </CardHeader>
             <CardContent className="p-0">
               <p className="text-muted-foreground mb-4">
                 {user ? "Connect with friends and compare stats." : "Register to connect with friends."}
               </p>
               <Button className={`w-full ${user ? 'bg-primary hover:bg-primary/90' : ''}`} variant={user ? 'default' : 'secondary'} onClick={() => router.push(user ? '/friends' : '/register')} disabled={!user}>
                 {user ? "Manage Friends" : "Register for Friends"}
               </Button>
             </CardContent>
           </Card>

          <Card className="bg-card p-6 rounded-lg shadow-md md:col-span-2 lg:col-span-1">
            <CardHeader className="p-0 mb-4">
              <CardTitle className="text-xl font-semibold text-card-foreground">Profile</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <p className="text-muted-foreground mb-4">
                {user ? "Manage your account settings and preferences." : "Register to create a profile."}
              </p>
              <Button className={`w-full ${user ? 'bg-primary hover:bg-primary/90' : ''}`} variant={user ? 'default' : 'secondary'} onClick={() => router.push(user ? `/profile?id=${user.uid}` : '/register')} disabled={!user}>
                {user ? "Edit Profile" : "Register for Profile"}
              </Button>
            </CardContent>
          </Card>

          {/* Statistics Summary Card */}
          <Card className="bg-card p-6 rounded-lg shadow-md md:col-span-2">
            <CardHeader className="p-0 mb-4">
              <CardTitle className="text-xl font-semibold text-card-foreground">Your Stats Summary</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {!user ? (
                <p className="text-muted-foreground mb-4">Register to track your statistics.</p>
              ) : gamesLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              ) : gamesError ? (
                <p className="text-destructive">Error loading stats. Please try again later.</p>
              ) : summaryStats && summaryStats.gamesPlayed > 0 ? (
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div>
                    <span className="font-semibold">Games Played:</span>
                    <span className="ml-2 text-foreground">{summaryStats.gamesPlayed}</span>
                  </div>
                  <div>
                    <span className="font-semibold">Wins:</span>
                    <span className="ml-2 text-green-500">{summaryStats.wins}</span>
                  </div>
                  <div>
                    <span className="font-semibold">Losses:</span>
                    <span className="ml-2 text-red-500">{summaryStats.losses}</span>
                  </div>
                  <div>
                    <span className="font-semibold">Win Rate:</span>
                    <span className="ml-2 text-foreground">{(summaryStats.winRate * 100).toFixed(0)}%</span>
                  </div>
                </div>
              ) : (
                 <p className="text-muted-foreground mb-4">No games played yet. Play some to see your stats!</p>
              )}
              <Button className={`w-full mt-4 ${user ? 'bg-primary hover:bg-primary/90' : ''}`} variant={user ? 'default' : 'secondary'} onClick={() => router.push(user ? `/stats?id=${user.uid}` : '/register')} disabled={!user}>
                {user ? "View All Stats" : "Register for Stats"}
              </Button>
            </CardContent>
          </Card>

        </div>
      </div>
    </AppLayout>
  );
}

    