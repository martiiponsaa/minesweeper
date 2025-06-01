'use client';

import { where, orderBy } from 'firebase/firestore';
 import AppLayout from '@/components/layout/AppLayout';
 import { useAuth } from '@/hooks/useAuth';
 import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
 import {
   ChartContainer,
   ChartTooltip,
   ChartTooltipContent,
} from "@/components/ui/chart"; // Assuming this is your chart component wrapper
  import { BarChart, CartesianGrid, XAxis, YAxis, Bar as RechartsBar, PieChart, Pie, Cell as RechartsCell, Legend as RechartsLegend, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts" 
 import { Button } from "@/components/ui/button";
 import { useRouter } from "next/navigation";
 import { BarChart3, History, CheckCircle2, XCircle, Hourglass, PauseCircle, Users } from 'lucide-react'; 
import React, { useState, useEffect } from 'react'; // Import useState and useEffect
 import { GameSchema, type Game } from '@/lib/firebaseTypes';
 import { Skeleton } from '@/components/ui/skeleton';
 import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
 import { AlertCircle } from 'lucide-react';
 import { useSearchParams } from 'next/navigation';
 import { useFirestoreDocument } from '@/hooks/useFirestoreDocument';
import { ChevronLeft } from 'lucide-react';
 import { UserSchema, type User as UserType } from '@/lib/firebaseTypes';
import { useFirestoreCollection } from '@/hooks/useFirestoreCollection';


 export default function StatsPageContent() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const userIdFromUrl = searchParams.get('id');
    const targetUserId = userIdFromUrl && user?.uid !== userIdFromUrl ? userIdFromUrl : user?.uid;

    const { data: games, loading: gamesLoading, error: gamesError } = useFirestoreCollection<Game>(
 'games',
        GameSchema,
        targetUserId ? [where('userId', '==', targetUserId), orderBy('startTime', 'desc')] : [],
        !targetUserId // Disable if no target user ID
    );
    
    // State for actions per game chart data
    const [actionsPerGameChartData, setActionsPerGameChartData] = useState<{ index: number; id: string; difficulty?: string; result: string; actions: number; }[]>([]);

    const calculateStats = () => {
        if (!games || games.length === 0) {
            return {
                gamesPlayed: 0,
                wins: 0,
                losses: 0,
                winRate: 0,
                avgSolveTime: 0, 
                gamesByDifficulty: [],
                winLossData: [],
            };
        }

        let wins = 0;
        let losses = 0;
        let totalSolveTime = 0;
        let completedGamesCount = 0;
        const totalSolveTimePerDifficulty: Record<string, number> = {};
        const difficultyCounts: Record<string, {played: number, wins: number}> = {};

        games.forEach(game => {
            if (game.result === 'won') {
                wins++;
                if (game.endTime && game.startTime) {
                    totalSolveTime += (game.endTime.toDate().getTime() - game.startTime.toDate().getTime()) / 1000;
                    if (game.difficulty) {
                        if (!totalSolveTimePerDifficulty[game.difficulty]) totalSolveTimePerDifficulty[game.difficulty] = 0;
                        totalSolveTimePerDifficulty[game.difficulty] += (game.endTime.toDate().getTime() - game.startTime.toDate().getTime()) / 1000;
                    } else { /* Handle games without difficulty if necessary */ }
                    completedGamesCount++;
                }
            } else if (game.result === 'lost') {
                losses++;
                if (game.endTime && game.startTime) { 
                    totalSolveTime += (game.endTime.toDate().getTime() - game.startTime.toDate().getTime()) / 1000;
                    completedGamesCount++;
                    if (game.difficulty) {
                        if (!totalSolveTimePerDifficulty[game.difficulty]) totalSolveTimePerDifficulty[game.difficulty] = 0;
                        totalSolveTimePerDifficulty[game.difficulty] += (game.endTime.toDate().getTime() - game.startTime.toDate().getTime()) / 1000;
                    }
                    difficultyCounts[game.difficulty] = { played: 0, wins: 0 };
                }
                difficultyCounts[game.difficulty].played++;
                if (game.result === 'won') {
                    difficultyCounts[game.difficulty].wins++;
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
                } else { return `${durationInSeconds}s`; }})() : 0;

        const avgSolveTimePerDifficulty: Record<string, string> = {};
        Object.keys(difficultyCounts).forEach(difficulty => {
            const gamesPlayedAtDifficulty = difficultyCounts[difficulty].played;
            const totalTime = totalSolveTimePerDifficulty[difficulty] || 0;
            if (gamesPlayedAtDifficulty > 0 && completedGamesCount > 0) { // Added completedGamesCount check here
                 const durationInSeconds = Math.round(totalTime / gamesPlayedAtDifficulty); // Corrected variable
                 if (durationInSeconds >= 60) {
                    const minutes = Math.floor(durationInSeconds / 60);
                    const seconds = durationInSeconds % 60;
                    avgSolveTimePerDifficulty[difficulty] = `${minutes}m ${seconds}s`;
                 } else {
                    avgSolveTimePerDifficulty[difficulty] = `${durationInSeconds}s`;
                 }
            } else {
                 avgSolveTimePerDifficulty[difficulty] = 'N/A';
            }
        });

        const gamesByDifficulty = Object.entries(difficultyCounts).map(([name, data]) => ({
            name, played: data.played, wins: data.wins, avgSolveTime: avgSolveTimePerDifficulty[name] || 'N/A'
        }));
        
        const actionsPerGameData: { id: string; difficulty?: string; result: string; actions: number }[] = [];
        games.forEach(game => {
            if ((game.result === 'won' || game.result === 'lost') && game.moves) {
                actionsPerGameData.push({
                    id: game.id,
                    difficulty: game.difficulty,
                    result: game.result,
                    actions: game.moves.length,
                });
            }
        });

        // Sort actionsPerGameData by the number of actions for potentially better visualization
        actionsPerGameData.sort((a, b) => a.actions - b.actions);

        // Prepare data for actions per game chart - using index for X-axis for simplicity
        const actionsPerGameChartData = actionsPerGameData.map((game, index) => ({
 index: index + 1, // Use index as the identifier on the chart
 id: game.id, // Keep id for tooltip
 difficulty: game.difficulty,
 result: game.result,
 actions: game.actions,
        }));

        const winLossData = [

            { name: 'Wins', value: wins, fill: 'hsl(var(--chart-1))' }, // Teal-like
            { name: 'Losses', value: losses, fill: 'hsl(var(--chart-3))' }, // Gold-like
        ];

        return { gamesPlayed, wins, losses, winRate, avgSolveTime, gamesByDifficulty, winLossData, avgSolveTimePerDifficulty };
    };

    useEffect(() => {
        if (games) {
            const { actionsPerGameChartData } = calculateStats();
            setActionsPerGameChartData(actionsPerGameChartData ?? []);
        }
    }, [games]);

    // Fetch the target user's data to display their name if viewing another user's profile    const { data: targetUserData, loading: targetUserLoading, error: targetUserError } = useFirestoreDocument<UserType>(
    const { data: targetUserData, loading: targetUserLoading, error: targetUserError } = useFirestoreDocument<UserType>(
        'users',
        targetUserId, // Fetch data for the determined targetUserId
        UserSchema,
    );
    const stats = calculateStats(); // Calculate stats initially and on games change
     
    const chartConfig = {
       played: { label: "Played", color: "hsl(var(--primary))" }, 
       wins: { label: "Wins", color: "hsl(var(--accent))" }, // Gold
    } satisfies import("@/components/ui/chart").ChartConfig
     
   return (
     <AppLayout>
         <div className="container mx-auto p-4 md:p-8 relative">

            {/* Back to My Profile Button */}
            {userIdFromUrl && user?.uid !== userIdFromUrl && (
                <Button
                    variant="outline"
                    // Adjusted top spacing and added margin-bottom
                    className="absolute top-4 left-4 md:top-8 md:left-8 z-10 mb-4"

                    onClick={() => router.push(`/profile?id=${userIdFromUrl}`)}
                >   {/* Use user?.profilePreferences?.displayName or user?.username as fallback */}
                    <ChevronLeft className="h-4 w-4 mr-2" /> Back to{' '}
                    {targetUserData?.profilePreferences?.displayName || targetUserData?.username
                        ? `${targetUserData?.profilePreferences?.displayName || targetUserData?.username}'s`
                        : 'My'}{' '}
                    Profile
                </Button>
            )}
            {authLoading ? (
                 <div className="space-y-6">
                    <Skeleton className="h-10 w-1/3 mb-4" />
                    <Skeleton className="h-40 w-full rounded-lg" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Skeleton className="h-60 w-full rounded-lg" />
                        <Skeleton className="h-60 w-full rounded-lg" />
                    </div>
                 </div>
             ) : !user ? (
                 <div className="flex flex-col items-center justify-center text-center">
                     <BarChart3 className="h-16 w-16 text-muted-foreground mb-4" />
                     <h1 className="text-2xl font-bold text-foreground mb-3">Track Your Performance</h1>
                     <p className="text-muted-foreground mb-6 max-w-md">
                       To view detailed statistics about your games, including win rates, solve times, and accuracy, please create an account or log in. Guest progress is not tracked.
                     </p>
                     <Button onClick={() => router.push('/register')}>
                       Register or Login
                     </Button>
                 </div>
             ) : (
                <>
                 {/* Add margin-top to the title when the back button is visible */}
                 <h1 className={`text-3xl font-bold text-foreground mb-8 ${userIdFromUrl && user?.uid !== userIdFromUrl ? 'mt-12 md:mt-16' : ''}`}>
                    {targetUserId === user?.uid || !targetUserId
                        ? 'Your Statistics'
                        : targetUserData?.profilePreferences?.displayName || targetUserData?.username
                            ? `${targetUserData.username}'s Statistics`
                            : 'User\'s Statistics'}
                 </h1>
                 
                 {gamesLoading && (
                    <div className="space-y-6">
                        <Skeleton className="h-40 w-full rounded-lg" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Skeleton className="h-60 w-full rounded-lg" />
                            <Skeleton className="h-60 w-full rounded-lg" />
                        </div>
                    </div>
                 )}

                 {!gamesLoading && gamesError && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Error Loading Stats</AlertTitle>
                        <AlertDescription>
                           Could not load your game statistics. Please try again later.
                           {gamesError.message && <p className="text-sm mt-1">Details: {gamesError.message}</p>}
                        </AlertDescription>
                    </Alert>
                 )}

                 {!gamesLoading && !gamesError && (
                    <div className="space-y-6">
                         <Card>
                             <CardHeader>
                                 <CardTitle>Overall Performance</CardTitle>
                                 <CardDescription>A summary of your Minesweeper career.</CardDescription>
                             </CardHeader>
                             <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 text-center">
                                 <div>
                                     <p className="text-2xl font-bold">{stats.gamesPlayed}</p> 
                                     <p className="text-sm text-muted-foreground">Games Played</p>
                                 </div>
                                 <div>
                                     <p className="text-2xl font-bold">{stats.wins}</p>
                                     <p className="text-sm text-muted-foreground">Wins</p>
                                 </div>
                                 <div>
                                     <p className="text-2xl font-bold">{stats.losses}</p>
                                     <p className="text-sm text-muted-foreground">Losses</p>
                                 </div>
                                 <div>
                                     <p className="text-2xl font-bold">{(stats.winRate * 100).toFixed(0)}%</p>
                                     <p className="text-sm text-muted-foreground">Win Rate</p>
                                 </div>
                                 <div>
                                     <p className="text-2xl font-bold">{stats.avgSolveTime}</p>
                                     <p className="text-sm text-muted-foreground">Avg. Solve Time</p>
                                 </div>
                             </CardContent>

                             {games.length === 0 && (
                                <CardFooter className="justify-center">
                                    <p className="text-muted-foreground">Play some games to see your stats!</p>
                                </CardFooter>
                             )}
                         </Card>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Win/Loss Ratio</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {stats.wins === 0 && stats.losses === 0 && games.length > 0 ? (
                                        <p className="text-muted-foreground text-center py-10">No completed (won/lost) games to show win/loss data. Keep playing!</p>
                                    ) : stats.wins === 0 && stats.losses === 0 && games.length === 0 ? (
                                        <p className="text-muted-foreground text-center py-10">Play some games to see your win/loss ratio.</p>
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
                                        <BarChart data={stats.gamesByDifficulty} layout="vertical" margin={{right: 20}}>
                                            <CartesianGrid horizontal={false} />
                                            <XAxis type="number" dataKey="played" />
                                            <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={60}/>
                                            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                                            <RechartsBar dataKey="played" fill="var(--color-played)" radius={4} name="Played"/>
                                            <RechartsBar dataKey="wins" fill="var(--color-wins)" radius={4} name="Wins"/>
                                           </BarChart>
                                    </ChartContainer>
                                    )}
                                </CardContent>
                            </Card>
                            {/* Average Solve Time by Difficulty */}
                            {stats.avgSolveTimePerDifficulty && Object.keys(stats.avgSolveTimePerDifficulty).length > 0 && (
                                 <Card>
                                    <CardHeader>
                                        <CardTitle>Average Solve Time by Difficulty</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <ul className="space-y-2">
                                            {Object.entries(stats.avgSolveTimePerDifficulty).map(([difficulty, avgTime]) => (
                                                <li key={difficulty} className="flex justify-between items-center">
                                                    <span className="font-medium">{difficulty}:</span>
                                                    <span>{avgTime}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </CardContent>
                                 </Card>
                            )}
                        </div>
                    </div>
                 )}
                </>
             )}
         </div>
     </AppLayout>
   );
 }
