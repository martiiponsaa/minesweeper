'use client';

 import AppLayout from '@/components/layout/AppLayout';
 import { useAuth } from '@/hooks/useAuth';
 import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
 import {
   ChartContainer,
   ChartTooltip,
   ChartTooltipContent,
 } from "@/components/ui/chart"
  import { BarChart, CartesianGrid, XAxis, Bar, LineChart, Line } from "recharts" // Added LineChart, Line
 import { Button } from "@/components/ui/button";
 import { useRouter } from "next/navigation";
 import { BarChart3 } from 'lucide-react'; // Import an icon

 
 export default function StatsPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();

    // Placeholder data - replace with actual fetched data for logged-in users
    const chartData = [
       { month: "January", games: 10, wins: 5, winRate: 0.5, accuracy: 0.85 },
       { month: "February", games: 15, wins: 9, winRate: 0.6, accuracy: 0.88 },
       { month: "March", games: 8, wins: 6, winRate: 0.75, accuracy: 0.90 },
       { month: "April", games: 20, wins: 12, winRate: 0.6, accuracy: 0.82 },
       { month: "May", games: 12, wins: 7, winRate: 0.58, accuracy: 0.87 },
       { month: "June", games: 18, wins: 15, winRate: 0.83, accuracy: 0.92 },
     ]

     const chartConfig = {
       games: {
         label: "Games Played",
         color: "hsl(var(--primary))", // Teal
       },
       wins: {
          label: "Wins",
          color: "hsl(var(--accent))", // Gold
        },
       winRate: {
         label: "Win Rate",
         color: "hsl(var(--chart-3))", // Gold variation
       },
       accuracy: {
         label: "Move Accuracy",
         color: "hsl(var(--chart-1))", // Teal variation
       }
     } satisfies import("@/components/ui/chart").ChartConfig
     
   return (
     <AppLayout>
         <div className="container mx-auto p-4 md:p-8">
             
            {/* Conditional Rendering Based on Auth Status */}
             {authLoading ? (
                 // Still loading user data
                 <div className="text-center text-muted-foreground py-10">
                     <p>Loading your stats...</p>
                 </div>
             ) : !user ? (
              // User is a GUEST (not logged in)
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
                 // User is logged in - Show Stats
                <>
                 <h1 className="text-3xl font-bold text-foreground mb-8">Your Statistics</h1>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     {/* Overall Performance Card */}
                     <Card>
                         <CardHeader>
                             <CardTitle>Overall Performance</CardTitle>
                             <CardDescription>A summary of your Minesweeper career.</CardDescription>
                         </CardHeader>
                         <CardContent className="grid grid-cols-2 gap-4 text-center">
                             <div>
                                 {/* TODO: Fetch and display actual data */}
                                 <p className="text-2xl font-bold">105</p> 
                                 <p className="text-sm text-muted-foreground">Games Played</p>
                             </div>
                             <div>
                                 <p className="text-2xl font-bold">65%</p>
                                 <p className="text-sm text-muted-foreground">Win Rate</p>
                             </div>
                             <div>
                                 <p className="text-2xl font-bold">1m 25s</p>
                                 <p className="text-sm text-muted-foreground">Avg. Solve Time</p>
                             </div>
                             <div>
                                 <p className="text-2xl font-bold">92%</p>
                                 <p className="text-sm text-muted-foreground">Move Accuracy</p>
                             </div>
                         </CardContent>
                     </Card>

                     {/* Games & Wins per Month Chart */}
                     <Card>
                         <CardHeader>
                             <CardTitle>Games & Wins per Month</CardTitle>
                             <CardDescription>Your activity over the last few months.</CardDescription>
                         </CardHeader>
                         <CardContent>
                             <ChartContainer config={chartConfig} className="h-[200px] w-full">
                                 <BarChart accessibilityLayer data={chartData}>
                                     <CartesianGrid vertical={false} />
                                     <XAxis
                                         dataKey="month"
                                         tickLine={false}
                                         tickMargin={10}
                                         axisLine={false}
                                         tickFormatter={(value) => value.slice(0, 3)}
                                     />
                                     <ChartTooltip
                                         cursor={false}
                                         content={<ChartTooltipContent indicator="dashed" />}
                                     />
                                     <Bar dataKey="games" fill="var(--color-games)" radius={4} />
                                     <Bar dataKey="wins" fill="var(--color-wins)" radius={4} />
                                 </BarChart>
                             </ChartContainer>
                         </CardContent>
                     </Card>

                     {/* Win Rate Over Time Chart */}
                     <Card>
                         <CardHeader>
                             <CardTitle>Win Rate Over Time</CardTitle>
                              <CardDescription>Track your win percentage monthly.</CardDescription>
                         </CardHeader>
                         <CardContent>
                             <ChartContainer config={chartConfig} className="h-[200px] w-full">
                                <LineChart accessibilityLayer data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                                  <CartesianGrid vertical={false} />
                                  <XAxis
                                    dataKey="month"
                                    tickLine={false}
                                    axisLine={false}
                                    tickMargin={8}
                                    tickFormatter={(value) => value.slice(0, 3)}
                                  />
                                  <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                                  <Line dataKey="winRate" type="monotone" stroke="var(--color-winRate)" strokeWidth={2} dot={false} />
                                </LineChart>
                              </ChartContainer>
                         </CardContent>
                     </Card>

                     {/* Move Accuracy Trend Chart */}
                     <Card>
                         <CardHeader>
                             <CardTitle>Move Accuracy Trend</CardTitle>
                             <CardDescription>How your move accuracy has changed.</CardDescription>
                         </CardHeader>
                         <CardContent>
                             <ChartContainer config={chartConfig} className="h-[200px] w-full">
                                <LineChart accessibilityLayer data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                                  <CartesianGrid vertical={false} />
                                  <XAxis
                                    dataKey="month"
                                    tickLine={false}
                                    axisLine={false}
                                    tickMargin={8}
                                    tickFormatter={(value) => value.slice(0, 3)}
                                  />
                                  <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                                  <Line dataKey="accuracy" type="monotone" stroke="var(--color-accuracy)" strokeWidth={2} dot={false} />
                                </LineChart>
                              </ChartContainer>
                         </CardContent>
                     </Card>
                 </div>
                </>
             )}
         </div>
     </AppLayout>
   );
 }
