'use client';
  import AppLayout from '@/components/layout/AppLayout';
  import { Button } from '@/components/ui/button';
  import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
  import { Label } from "@/components/ui/label"
  import React, { useState } from 'react';
  import { AuthCheck } from '@/components/auth/AuthCheck'; // Import AuthCheck

  export default function PlayPage() {
    const [difficulty, setDifficulty] = useState('medium'); // Default difficulty

    const handleStartGame = () => {
        console.log("Starting game with difficulty:", difficulty);
        // TODO: Implement game starting logic based on difficulty
    };

    return (
      // Wrap with AuthCheck
      <AuthCheck redirectTo="/login">
        <AppLayout>
          <div className="container mx-auto p-4 md:p-8 flex flex-col items-center">
            <h1 className="text-3xl font-bold text-foreground mb-8">Play MineVerse</h1>

            <Card className="w-full max-w-3xl mb-8">
               <CardHeader>
                   <CardTitle>New Game Setup</CardTitle>
                    <CardDescription>Choose your difficulty and start playing.</CardDescription>
               </CardHeader>
                <CardContent className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="flex-1 w-full sm:w-auto">
                       <Label htmlFor="difficulty-select">Difficulty</Label>
                       <Select value={difficulty} onValueChange={setDifficulty}>
                         <SelectTrigger id="difficulty-select" className="w-full">
                           <SelectValue placeholder="Select difficulty" />
                         </SelectTrigger>
                         <SelectContent>
                           <SelectItem value="easy">Easy</SelectItem>
                           <SelectItem value="medium">Medium</SelectItem>
                           <SelectItem value="hard">Hard</SelectItem>
                         </SelectContent>
                       </Select>
                    </div>
                     <Button onClick={handleStartGame} className="w-full sm:w-auto mt-4 sm:mt-6">
                       Start New Game
                     </Button>
                </CardContent>
            </Card>

             {/* Game Board Area */}
             <Card className="w-full max-w-3xl">
               <CardHeader>
                   <CardTitle>Game Board</CardTitle>
               </CardHeader>
                <CardContent>
                     {/* Placeholder for the Minesweeper grid */}
                     <div className="aspect-square bg-muted rounded flex items-center justify-center text-muted-foreground p-10">
                         <p className="text-center">Minesweeper game board will be rendered here.<br/>Select difficulty and click "Start New Game".</p>
                     </div>
                </CardContent>
                 <CardFooter className="flex justify-between">
                    <Button variant="outline">Restart</Button>
                    <Button variant="secondary">Save Game</Button>
                    <Button variant="destructive">Quit Game</Button>
                  </CardFooter>
             </Card>

          </div>
        </AppLayout>
      </AuthCheck>
    );
  }
