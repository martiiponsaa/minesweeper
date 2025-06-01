
"use client"; // Add this line at the top

import React, { useState, useEffect } from 'react';
import { where, orderBy } from 'firebase/firestore';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { useSearchParams, useRouter } from 'next/navigation'; // useRouter imported here
import { useFirestoreCollection } from '@/hooks/useFirestoreCollection';
import { Button } from '@/components/ui/button'; // Assuming Button component location
import { useFirestoreDocument } from '@/hooks/useFirestoreDocument';
import { UserSchema, type User as UserType } from '@/lib/firebaseTypes';
import { GameSchema, type Game } from '@/lib/firebaseTypes';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const CompareStatsPage: React.FC = () => {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const friendId = searchParams.get('friendId');

  const { data: userGames, loading: userGamesLoading, error: userGamesError } = useFirestoreCollection<Game>(
    'games',
    GameSchema,
    user?.uid ? [where('userId', '==', user.uid), orderBy('startTime', 'desc')] : [],
    !user?.uid
  );

  const { data: friendGames, loading: friendGamesLoading, error: friendGamesError } = useFirestoreCollection<Game>(
    'games',
    GameSchema,
    friendId ? [where('userId', '==', friendId), orderBy('startTime', 'desc')] : [],
    !friendId
  );

  const { data: friendUserData, loading: friendUserLoading, error: friendUserError } = useFirestoreDocument<UserType>(
    'users',
    friendId,
    UserSchema,
  );

  const calculateStats = (games: Game[] | null) => {
      if (!games || games.length === 0) {
          return {
              gamesPlayed: 0,
              wins: 0,
              losses: 0,
              winRate: 0,
              avgSolveTime: 'N/A',
          };
      }

      let wins = 0;
      let losses = 0;
      let totalSolveTime = 0;
      let completedGamesCount = 0;

      games.forEach(game => {
          if (game.result === 'won') {
              wins++;
              if (game.endTime && game.startTime) {
                  totalSolveTime += (game.endTime.toDate().getTime() - game.startTime.toDate().getTime()) / 1000;
                  completedGamesCount++;
              }
          } else if (game.result === 'lost') {
              losses++;
               if (game.endTime && game.startTime) {
                  totalSolveTime += (game.endTime.toDate().getTime() - game.startTime.toDate().getTime()) / 1000;
                  completedGamesCount++;
              }
          }
      });

      const gamesPlayed = games.length;
      const winRate = gamesPlayed > 0 && (wins + losses) > 0 ? parseFloat((wins / (wins + losses)).toFixed(2)) : 0;
      const avgSolveTime = completedGamesCount > 0
          ? (() => {
              const durationInSeconds = Math.round(totalSolveTime / completedGamesCount);
              if (durationInSeconds >= 60) {
                  const minutes = Math.floor(durationInSeconds / 60);
                  const seconds = durationInSeconds % 60;
                  return `${minutes}m ${seconds}s`;
                } else { return `${durationInSeconds}s` }})() : 'N/A';

      return { gamesPlayed, wins, losses, winRate, avgSolveTime };
  };

  const userStats = calculateStats(userGames);
  const friendStats = calculateStats(friendGames);

  const loading = authLoading || userGamesLoading || friendGamesLoading || friendUserLoading;
  const error = userGamesError || friendGamesError;


  if (loading) {
    return (
      <AppLayout>
        <div className="container mx-auto p-4">
          <Skeleton className="h-10 w-32 mb-4" />
          <Skeleton className="h-8 w-48 mb-6" />
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex justify-between">
                    <Skeleton className="h-5 w-1/4" />
                    <Skeleton className="h-5 w-1/4" />
                    <Skeleton className="h-5 w-1/4" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="container mx-auto p-4">
          <Card>
            <CardHeader>
              <CardTitle>Error</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-destructive">Error loading stats: {error.message}</p>
              <Button onClick={() => router.push('/friends')} className="mt-4">
                Back to Friends
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

    return (
        <AppLayout>
            <div className="container mx-auto p-4">
                <Button onClick={() => router.push('/friends')} className="mb-4" variant="outline">
                    Back to Friends
                </Button>
                <h1 className="text-2xl font-bold mb-6 text-foreground">Stats Comparison</h1>
                {!user || !friendId ? (
                    <Card>
                        <CardContent className="p-6 text-center text-muted-foreground">
                            Please log in and select a friend to compare stats.
                        </CardContent>
                    </Card>
                ) : (
                    <Card>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Stat</TableHead>
                                        <TableHead>Your Stats</TableHead>
                                        <TableHead>{friendUserData?.profilePreferences?.displayName || friendUserData?.username || 'Friend'}'s Stats</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <TableRow>
                                        <TableCell className="font-medium">Games Played</TableCell>
                                        <TableCell>{userStats.gamesPlayed}</TableCell>
                                        <TableCell>{friendStats.gamesPlayed}</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell className="font-medium">Wins</TableCell>
                                        <TableCell>{userStats.wins}</TableCell>
                                        <TableCell>{friendStats.wins}</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell className="font-medium">Losses</TableCell>
                                        <TableCell>{userStats.losses}</TableCell>
                                        <TableCell>{friendStats.losses}</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell className="font-medium">Win Rate</TableCell>
                                        <TableCell>{(userStats.winRate * 100).toFixed(0)}%</TableCell>
                                        <TableCell>{(friendStats.winRate * 100).toFixed(0)}%</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell className="font-medium">Avg. Solve Time</TableCell>
                                        <TableCell>{userStats.avgSolveTime}</TableCell>
                                        <TableCell>{friendStats.avgSolveTime}</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                )}
            </div>
        </AppLayout>
    );
};

export default CompareStatsPage;
