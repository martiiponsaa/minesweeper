
'use client';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import React, { useState, useEffect } from 'react';
import GameBoard from '@/components/minesweeper/GameBoard';
import { DIFFICULTY_LEVELS, type DifficultyKey } from '@/config/minesweeperSettings';
import { useAuth } from '@/hooks/useAuth'; 
import { useRouter } from 'next/navigation';
import { Save, LogOutIcon, RotateCcw } from 'lucide-react';
import { getFirebase } from '@/firebase';
import { doc, setDoc, Timestamp, collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Game } from '@/lib/firebaseTypes'; // Game type for Firestore
import { GameSchema } from '@/lib/firebaseTypes'; // Zod schema for validation if needed (optional here for direct set)


export default function PlayPage() {
  const [selectedDifficultyKey, setSelectedDifficultyKey] = useState<DifficultyKey>('medium');
  const [gameKey, setGameKey] = useState<number>(0); 
  const [showBoard, setShowBoard] = useState<boolean>(false);
  const { user } = useAuth();
  const router = useRouter();
  const { firestore } = getFirebase();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const handleStartGame = () => {
    setShowBoard(true);
    setGameKey(prevKey => prevKey + 1); 
  };

  const handleRestartGame = () => {
    if (showBoard) {
      setGameKey(prevKey => prevKey + 1); 
    }
  };
  
  const handleSaveGame = async () => {
    if (!user) {
      toast({
        title: "Login Required",
        description: "You need to be logged in to save your game progress.",
        variant: "destructive",
      });
      return;
    }
    if (!firestore) {
        toast({
            title: "Error",
            description: "Firestore is not available. Cannot save game.",
            variant: "destructive",
        });
        return;
    }

    setIsSaving(true);

    // Create a new game document ID
    const gameDocRef = doc(collection(firestore, 'games'));

    // NOTE: In a full implementation, you'd get the current board state
    // from the GameBoard component (e.g., via a callback or shared state).
    // For this example, we'll save the setup and a placeholder for gameState.
    const gameData: Omit<Game, 'id'> = {
      userId: user.uid,
      startTime: Timestamp.now(),
      endTime: null, // Game is in progress
      // gameState: JSON.stringify(initialBoardState), // Placeholder - replace with actual board state
      gameState: "PLACEHOLDER_SERIALIZED_BOARD_STATE", // Replace with actual serialized board
      difficulty: DIFFICULTY_LEVELS[selectedDifficultyKey].name,
      moves: [], // Initialize with empty moves, or get current moves
      result: null, // Game is in progress
    };

    try {
      // You could validate gameData with GameSchema.omit({ id: true }).parse(gameData) here if desired
      await setDoc(gameDocRef, gameData);
      toast({
        title: "Game Saved!",
        description: "Your game progress has been saved.",
        variant: "default",
      });
    } catch (error) {
      console.error("Error saving game:", error);
      toast({
        title: "Save Failed",
        description: "Could not save your game. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuitGame = () => {
    setShowBoard(false); 
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
              <Select value={selectedDifficultyKey} onValueChange={(value) => setSelectedDifficultyKey(value as DifficultyKey)} disabled={showBoard && gameKey > 0}>
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
                disabled={!user || isSaving} 
                className="w-full sm:w-auto"
                title={!user ? "Login to save your game" : "Save your current game"}
              >
                <Save className="mr-2 h-4 w-4" /> {isSaving ? "Saving..." : "Save Game"}
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

