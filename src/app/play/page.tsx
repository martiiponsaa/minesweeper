
'use client';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import React, { useState, useEffect } from 'react';
import GameBoard from '@/components/minesweeper/GameBoard';
import { DIFFICULTY_LEVELS, type DifficultyKey } from '@/config/minesweeperSettings';
import { useAuth } from '@/hooks/useAuth'; // To check if user is guest
import { useRouter } from 'next/navigation';
import { Save, LogOutIcon, RotateCcw } from 'lucide-react';


export default function PlayPage() {
  const [selectedDifficultyKey, setSelectedDifficultyKey] = useState<DifficultyKey>('medium');
  const [gameKey, setGameKey] = useState<number>(0); // Used to force re-render of GameBoard
  const [showBoard, setShowBoard] = useState<boolean>(false);
  const { user } = useAuth();
  const router = useRouter();

  const handleStartGame = () => {
    setShowBoard(true);
    setGameKey(prevKey => prevKey + 1); // Increment key to remount GameBoard
  };

  const handleRestartGame = () => {
    if (showBoard) {
      setGameKey(prevKey => prevKey + 1); // Re-initialize GameBoard by changing its key
    }
  };
  
  const handleSaveGame = () => {
    // TODO: Implement save game logic (requires user to be logged in)
    if (!user) {
      // Show toast or modal prompting to register/login
      console.log("Guest cannot save game. Please register or login.");
    } else {
      console.log("Saving game for user:", user.uid);
    }
  };

  const handleQuitGame = () => {
    setShowBoard(false); // Hide the board, user can setup a new game
    // Optionally, navigate away or show a confirmation
    // router.push('/dashboard');
  };


  return (
    <AppLayout>
      <div className="container mx-auto p-4 md:p-8 flex flex-col items-center">
        <h1 className="text-3xl font-bold text-foreground mb-8">Play MineVerse</h1>

        <Card className="w-full max-w-3xl mb-8">
          <CardHeader>
            <CardTitle>New Game Setup</CardTitle>
            <CardDescription>Choose your difficulty and start sweeping mines!</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-1 w-full sm:w-auto">
              <Label htmlFor="difficulty-select">Difficulty</Label>
              <Select value={selectedDifficultyKey} onValueChange={(value) => setSelectedDifficultyKey(value as DifficultyKey)}>
                <SelectTrigger id="difficulty-select" className="w-full">
                  <SelectValue placeholder="Select difficulty" />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(DIFFICULTY_LEVELS).map(key => (
                    <SelectItem key={key} value={key}>
                      {DIFFICULTY_LEVELS[key as DifficultyKey].name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleStartGame} className="w-full sm:w-auto mt-4 sm:mt-6 bg-primary hover:bg-primary/90">
              {showBoard ? 'Start New Game' : 'Start Game'}
            </Button>
          </CardContent>
        </Card>

        {/* Game Board Area */}
        {showBoard ? (
          <Card className="w-full max-w-3xl">
            <CardHeader>
              <CardTitle>
                MineVerse Board - {DIFFICULTY_LEVELS[selectedDifficultyKey].name}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 sm:p-2 md:p-4">
              <GameBoard key={gameKey} difficultyKey={selectedDifficultyKey} isGuest={!user} />
            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row justify-between gap-2 pt-4">
              <Button variant="outline" onClick={handleRestartGame} className="w-full sm:w-auto">
                <RotateCcw className="mr-2 h-4 w-4" /> Restart
              </Button>
              <Button 
                variant="secondary" 
                onClick={handleSaveGame} 
                disabled={!user} 
                className="w-full sm:w-auto"
                title={!user ? "Login to save your game" : "Save your current game"}
              >
                <Save className="mr-2 h-4 w-4" /> Save Game
              </Button>
              <Button variant="destructive" onClick={handleQuitGame} className="w-full sm:w-auto">
                 <LogOutIcon className="mr-2 h-4 w-4" /> Quit Game
              </Button>
            </CardFooter>
          </Card>
        ) : (
          <Card className="w-full max-w-3xl">
            <CardHeader>
              <CardTitle>Game Board</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="aspect-video bg-muted rounded flex items-center justify-center text-muted-foreground p-10">
                <p className="text-center">Select difficulty and click "Start Game" to begin.</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
