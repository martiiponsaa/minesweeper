'use client';
 import AppLayout from '@/components/layout/AppLayout';
 import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
 import {
   ChartContainer,
   ChartTooltip,
   ChartTooltipContent,
 } from "@/components/ui/chart"
  import { BarChart, CartesianGrid, XAxis, Bar } from "recharts"
  import { AuthCheck } from '@/components/auth/AuthCheck'; // Import AuthCheck

 export default function StatsPage() {

    // Placeholder data - replace with actual fetched data
    const chartData = [
       { month: "January", games: 10, wins: 5 },
       { month: "February", games: 15, wins: 9 },
       { month: "March", games: 8, wins: 6 },
       { month: "April", games: 20, wins: 12 },
       { month: "May", games: 12, wins: 7 },
       { month: "June", games: 18, wins: 15 },
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
     } satisfies import("@/components/ui/chart").ChartConfig

   return (
     // Wrap with AuthCheck
     <AuthCheck redirectTo="/login">
       <AppLayout>
         <div className="container mx-auto p-4 md:p-8">
           <h1 className="text-3xl font-bold text-foreground mb-8">Your Statistics</h1>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Placeholder for general stats */}
               <Card>
                 <CardHeader>
                    <CardTitle>Overall Performance</CardTitle>
                    <CardDescription>A summary of your Minesweeper career.</CardDescription>
                 </CardHeader>
                 <CardContent className="grid grid-cols-2 gap-4 text-center">
                    <div>
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

               {/* Placeholder for Games Played / Wins Chart */}
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

               {/* Add more cards for other stats/graphs */}
               <Card>
                   <CardHeader>
                      <CardTitle>Win Rate Over Time</CardTitle>
                   </CardHeader>
                   <CardContent>
                        <div className="h-40 bg-muted rounded flex items-center justify-center text-muted-foreground">
                          Win Rate Graph Coming Soon
                        </div>
                   </CardContent>
               </Card>
                <Card>
                    <CardHeader>
                       <CardTitle>Move Accuracy Trend</CardTitle>
                    </CardHeader>
                    <CardContent>
                         <div className="h-40 bg-muted rounded flex items-center justify-center text-muted-foreground">
                           Move Accuracy Graph Coming Soon
                         </div>
                    </CardContent>
                </Card>

           </div>
         </div>
       </AppLayout>
     </AuthCheck>
   );
 }
