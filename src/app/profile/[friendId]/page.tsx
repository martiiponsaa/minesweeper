
'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { useFirestoreDocument } from '@/hooks/useFirestoreDocument';
import { UserSchema, type User as UserType, GameSchema, type Game } from '@/lib/firebaseTypes';
import { useFirestoreCollection } from '@/hooks/useFirestoreCollection';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, BarChart3, History, CheckCircle2, XCircle, Hourglass, PauseCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { BarChart, CartesianGrid, XAxis, Bar as RechartsBar, PieChart, Pie, Cell as RechartsCell, Tooltip as RechartsTooltip, Legend as RechartsLegend } from "recharts"; // Aliased Bar to RechartsBar
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';


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


export default function FriendProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user: currentUser, loading: authLoading } = useAuth(); // Current logged-in user
  const friendId = typeof params.friendId === 'string' ? params.friendId : undefined;

  const { data: friendData, loading: friendLoading, error: friendError } = useFirestoreDocument<UserType>(
    'users',
    friendId,
    UserSchema
  );

  const { data: friendGames, loading: gamesLoading, error: gamesError } = useFirestoreCollection<Game>(
    'games',
    GameSchema,
    friendId ? [
        where('userId', '==', friendId),
        orderBy('startTime', 'desc'),
        limit(10) // Limit to last 10 games for performance on profile
    ] : [],
    !friendId // Disable if no friendId
  );
  
  const getInitials = (name?: string, email?: string) => {
    if (name) return name.charAt(0).toUpperCase();
    if (email) return email.charAt(0).toUpperCase();
    return '?';
  };

  const calculateStats = () => {
    if (!friendGames || friendGames.length === 0) {
        return {
            gamesPlayed: 0,
            wins: 0,
            losses: 0,
            winRate: 0,
            avgSolveTime: 0, // in seconds
            gamesByDifficulty: [],
            winLossData: [],
        };
    }

    let wins = 0;
    let losses = 0;
    let totalSolveTime = 0;
    let completedGamesCount = 0;
    const difficultyCounts: Record<string, {played: number, wins: number}> = {};

    friendGames.forEach(game => {
        if (game.result === 'won') {
            wins++;
            if (game.endTime && game.startTime) {
                totalSolveTime += (game.endTime.toDate().getTime() - game.startTime.toDate().getTime()) / 1000;
                completedGamesCount++;
            }
        } else if (game.result === 'lost') {
            losses++;
             if (game.endTime && game.startTime) { // Also count solve time for losses
                totalSolveTime += (game.endTime.toDate().getTime() - game.startTime.toDate().getTime()) / 1000;
                completedGamesCount++;
            }
        }

        if (game.difficulty) {
            if (!difficultyCounts[game.difficulty]) {
                difficultyCounts[game.difficulty] = { played: 0, wins: 0 };
            }
            difficultyCounts[game.difficulty].played++;
            if (game.result === 'won') {
                difficultyCounts[game.difficulty].wins++;
            }
        }
    });
    
    const gamesPlayed = friendGames.length; // All games including in-progress/quit for "played" count
    const winRate = gamesPlayed > 0 && (wins + losses) > 0 ? parseFloat((wins / (wins + losses)).toFixed(2)) : 0;
    const avgSolveTime = completedGamesCount > 0 ? Math.round(totalSolveTime / completedGamesCount) : 0;

    const gamesByDifficulty = Object.entries(difficultyCounts).map(([name, data]) => ({
        name,
        played: data.played,
        wins: data.wins,
    }));
    
    const winLossData = [
        { name: 'Wins', value: wins, fill: 'hsl(var(--chart-1))' },
        { name: 'Losses', value: losses, fill: 'hsl(var(--chart-3))' },
    ];


    return { gamesPlayed, wins, losses, winRate, avgSolveTime, gamesByDifficulty, winLossData };
  };

  const stats = calculateStats();
  
  const chartConfig = {
    played: { label: "Played", color: "hsl(var(--primary))" },
    wins: { label: "Wins", color: "hsl(var(--accent))" },
  } satisfies import("@/components/ui/chart").ChartConfig


  if (authLoading || friendLoading) {
    return (
      <AppLayout>
        <div className="container mx-auto p-4 md:p-8 space-y-6">
          <Skeleton className="h-12 w-1/3" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-48 rounded-lg md:col-span-1" />
            <Skeleton className="h-72 rounded-lg md:col-span-2" />
          </div>
          <Skeleton className="h-10 w-1/4" />
          <Skeleton className="h-60 w-full rounded-lg" />
        </div>
      </AppLayout>
    );
  }

  if (!currentUser) { // User must be logged in to view profiles
    return (
      <AppLayout>
        <div className="container mx-auto p-4 md:p-8 flex flex-col items-center justify-center text-center">
          <Users className="h-16 w-16 text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-3">Access Denied</h1>
          <p className="text-muted-foreground mb-6 max-w-md">
            You need to be logged in to view user profiles.
          </p>
          <Button onClick={() => router.push('/login')}>Login or Register</Button>
        </div>
      </AppLayout>
    );
  }
  
  if (friendError || !friendData) {
    return (
      <AppLayout>
        <div className="container mx-auto p-4 md:p-8">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              Could not load friend's profile. {friendError?.message || "The user may not exist or there was a network issue."}
            </AlertDescription>
          </Alert>
           <Button onClick={() => router.back()} variant="outline" className="mt-4">Go Back</Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto p-4 md:p-8 space-y-8">
        <div>
          <Button onClick={() => router.back()} variant="outline" className="mb-4">
            &larr; Back to Friends
          </Button>
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={friendData.profilePreferences?.avatar || undefined} alt={friendData.profilePreferences?.displayName || friendData.username} data-ai-hint="profile picture"/>
              <AvatarFallback className="text-3xl">{getInitials(friendData.profilePreferences?.displayName || friendData.username, friendData.email)}</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-3xl font-bold text-foreground">{friendData.profilePreferences?.displayName || friendData.username || 'Friend'}</h1>
              <p className="text-muted-foreground">@{friendData.username || friendData.userFriendCode} (Friend Code: {friendData.userFriendCode || 'N/A'})</p>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BarChart3 /> Overall Statistics</CardTitle>
            <CardDescription>A summary of {friendData.profilePreferences?.displayName || friendData.username}'s Minesweeper career.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-3xl font-bold">{stats.gamesPlayed}</p>
              <p className="text-sm text-muted-foreground">Games Played</p>
            </div>
            <div>
              <p className="text-3xl font-bold">{stats.wins}</p>
              <p className="text-sm text-muted-foreground">Wins</p>
            </div>
             <div>
              <p className="text-3xl font-bold">{stats.losses}</p>
              <p className="text-sm text-muted-foreground">Losses</p>
            </div>
            <div>
              <p className="text-3xl font-bold">{(stats.winRate * 100).toFixed(0)}%</p>
              <p className="text-sm text-muted-foreground">Win Rate</p>
            </div>
            <div>
              <p className="text-3xl font-bold">{stats.avgSolveTime}s</p>
              <p className="text-sm text-muted-foreground">Avg. Solve Time</p>
            </div>
          </CardContent>
        </Card>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>Win/Loss Ratio</CardTitle>
                </CardHeader>
                <CardContent>
                    {stats.wins === 0 && stats.losses === 0 ? (
                        <p className="text-muted-foreground text-center py-10">No completed games to show win/loss data.</p>
                    ) : (
                        <ChartContainer config={{ wins: { label: 'Wins', color: 'hsl(var(--chart-1))' }, losses: { label: 'Losses', color: 'hsl(var(--chart-3))' } }} className="h-[250px] w-full">
                            <PieChart>
                                <RechartsTooltip content={<ChartTooltipContent hideLabel />} />
                                <Pie data={stats.winLossData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                                    {stats.winLossData.map((entry, index) => (
                                        <RechartsCell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Pie>
                                <RechartsLegend />
                            </PieChart>
                        </ChartContainer>
                    )}
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Games by Difficulty</CardTitle>
                </CardHeader>
                <CardContent>
                    {stats.gamesByDifficulty.length === 0 ? (
                        <p className="text-muted-foreground text-center py-10">No games played to show difficulty stats.</p>
                    ) : (
                        <ChartContainer config={chartConfig} className="h-[250px] w-full">
                            <BarChart data={stats.gamesByDifficulty} layout="vertical" margin={{ right: 20 }}>
                                <CartesianGrid horizontal={false} />
                                <XAxis type="number" dataKey="played" />
                                <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={60} />
                                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                                <RechartsBar dataKey="played" fill="var(--color-played)" radius={4} name="Played" />
                                <RechartsBar dataKey="wins" fill="var(--color-wins)" radius={4} name="Wins" />
                            </BarChart>
                        </ChartContainer>
                    )}
                </CardContent>
            </Card>
        </div>


        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><History /> Recent Game History</CardTitle>
            <CardDescription>Last 10 games played by {friendData.profilePreferences?.displayName || friendData.username}.</CardDescription>
          </CardHeader>
          <CardContent>
            {gamesLoading && (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-md" />)}
              </div>
            )}
            {!gamesLoading && gamesError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>Could not load game history. {gamesError.message}</AlertDescription>
              </Alert>
            )}
            {!gamesLoading && !gamesError && friendGames.length === 0 && (
              <p className="text-muted-foreground text-center py-10">No game history found for this user.</p>
            )}
            {!gamesLoading && !gamesError && friendGames.length > 0 && (
              <ul className="divide-y divide-border">
                {friendGames.map((game) => (
                  <li key={game.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4">
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
                    <GameResultBadge result={game.result} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
          {friendGames.length > 0 && (
            <CardFooter>
                <p className="text-sm text-muted-foreground">Showing last {friendGames.length} games.</p>
            </CardFooter>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}
