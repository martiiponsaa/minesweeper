'use client';

import { where, orderBy } from 'firebase/firestore';
 import AppLayout from '@/components/layout/AppLayout';
 import { useAuth } from '@/hooks/useAuth';
 import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
 import {
   ChartContainer,
   ChartTooltip,
   ChartTooltipContent,
 } from "@/components/ui/chart"
  import { BarChart, CartesianGrid, XAxis, YAxis, Bar as RechartsBar, PieChart, Pie, Cell as RechartsCell, Legend as RechartsLegend, Tooltip as RechartsTooltip } from "recharts" 
 import { Button } from "@/components/ui/button";
 import { useRouter } from "next/navigation";
 import { BarChart3, History, CheckCircle2, XCircle, Hourglass, PauseCircle, Users } from 'lucide-react'; 
 import { useFirestoreCollection } from '@/hooks/useFirestoreCollection';
 import { GameSchema, type Game } from '@/lib/firebaseTypes';
 import { Skeleton } from '@/components/ui/skeleton';
 import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
 import { AlertCircle } from 'lucide-react';


 export default function StatsPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();

    const { data: games, loading: gamesLoading, error: gamesError } = useFirestoreCollection<Game>(
        'games',
        GameSchema,
        user ? [where('userId', '==', user.uid), orderBy('startTime', 'desc')] : [],
        !user // Disable if no user
    );
    
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
        const difficultyCounts: Record<string, {played: number, wins: number}> = {};

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
        
        const gamesPlayed = games.length;
        const winRate = gamesPlayed > 0 && (wins + losses) > 0 ? parseFloat((wins / (wins + losses)).toFixed(2)) : 0;
        const avgSolveTime = completedGamesCount > 0 ? Math.round(totalSolveTime / completedGamesCount) : 0;

        const gamesByDifficulty = Object.entries(difficultyCounts).map(([name, data]) => ({
            name,
            played: data.played,
            wins: data.wins,
        }));
        
        const winLossData = [
            { name: 'Wins', value: wins, fill: 'hsl(var(--chart-1))' }, // Teal-like
            { name: 'Losses', value: losses, fill: 'hsl(var(--chart-3))' }, // Gold-like
        ];

        return { gamesPlayed, wins, losses, winRate, avgSolveTime, gamesByDifficulty, winLossData };
    };

    const stats = calculateStats();
     
    const chartConfig = {
       played: { label: "Played", color: "hsl(var(--primary))" }, // Teal
       wins: { label: "Wins", color: "hsl(var(--accent))" }, // Gold
    } satisfies import("@/components/ui/chart").ChartConfig
     
   return (
     <AppLayout>
         <div className="container mx-auto p-4 md:p-8">
             
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
                 <h1 className="text-3xl font-bold text-foreground mb-8">Your Statistics</h1>
                 
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
                                     <p className="text-2xl font-bold">{stats.avgSolveTime}s</p>
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
                        </div>
                    </div>
                 )}
                </>
             )}
         </div>
     </AppLayout>
   );
 }
