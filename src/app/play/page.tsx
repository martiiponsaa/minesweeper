
'use client';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import React, { useState, useEffect, useRef } from 'react';
import GameBoard, { type GameBoardRef } from '@/components/minesweeper/GameBoard';
import { DIFFICULTY_LEVELS, type DifficultyKey } from '@/config/minesweeperSettings';
import { useAuth } from '@/hooks/useAuth'; 
import { useRouter } from 'next/navigation';
import { Save, LogOutIcon, RotateCcw } from 'lucide-react';
import { getFirebase } from '@/firebase';
import { doc, setDoc, Timestamp, collection, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Game, GameResult } from '@/lib/firebaseTypes'; 
import { GameSchema } from '@/lib/firebaseTypes'; 


export default function PlayPage() {
  const [selectedDifficultyKey, setSelectedDifficultyKey] = useState<DifficultyKey>('medium');
  const [gameKey, setGameKey] = useState<number>(0); 
  const [showBoard, setShowBoard] = useState<boolean>(false);
  const { user } = useAuth();
  const router = useRouter();
  const { firestore } = getFirebase();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const gameBoardRef = useRef<GameBoardRef>(null);
  const [activeGameId, setActiveGameId] = useState<string | null>(null);


  const handleStartGame = async () => {
    if (!user) { // Do not create a game document for guests
        setShowBoard(true);
        setGameKey(prevKey => prevKey + 1);
        setActiveGameId(null); // Ensure no active game ID for guests
        return;
    }

    if (!firestore) {
      toast({
        title: "Error",
        description: "Firestore is not available. Cannot start a new game.",
        variant: "destructive",
      });
      return;
    }

    // If there was a previous game in progress, mark it as quit
    if (activeGameId) {
        try {
            const gameDocRef = doc(firestore, 'games', activeGameId);
            await updateDoc(gameDocRef, {
                result: 'quit',
                endTime: Timestamp.now(),
            });
        } catch (error) {
            console.error("Error marking previous game as quit:", error);
        }
    }

    setShowBoard(true);
    setGameKey(prevKey => prevKey + 1);
    
    // Create a new game document for logged-in users
    const newGameDocRef = doc(collection(firestore, 'games'));
    setActiveGameId(newGameDocRef.id);

    const gameData: Omit<Game, 'id'> = {
      userId: user.uid,
      startTime: Timestamp.now(),
      endTime: null,
      gameState: "INITIAL_EMPTY_BOARD_STATE", // Will be updated by GameBoard's onGameEnd or manual save
      difficulty: DIFFICULTY_LEVELS[selectedDifficultyKey].name,
      moves: [],
      result: 'in-progress',
    };

    try {
      await setDoc(newGameDocRef, gameData);
      // toast({
      //   title: "New Game Started",
      //   description: "Your game has been created.",
      //   variant: "default"
      // });
    } catch (error) {
      console.error("Error creating new game:", error);
      toast({
        title: "Error Starting Game",
        description: "Could not create a new game record. Please try again.",
        variant: "destructive",
      });
      setShowBoard(false); // Don't show board if game creation failed
      setActiveGameId(null);
    }
  };

  const handleRestartGame = () => {
    // Restarting will trigger a new game creation via handleStartGame if a user is logged in
    // and the GameBoard component's key change will reset its internal state.
    // If a game was active, it will be marked as 'quit' by handleStartGame.
    handleStartGame(); 
  };
  
  const handleSaveGame = async () => {
    if (!user || !activeGameId) { // Only allow save if user is logged in and has an active game
      toast({
        title: !user ? "Login Required" : "No Active Game",
        description: !user ? "You need to be logged in to save your game progress." : "No active game to save.",
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
    if (!gameBoardRef.current) {
        toast({
            title: "Error",
            description: "Game board is not ready. Cannot save game.",
            variant: "destructive",
        });
        return;
    }

    setIsSaving(true);
    const currentBoardState = gameBoardRef.current.getCurrentBoardState();
    const currentTimeElapsed = gameBoardRef.current.getCurrentTimeElapsed(); // Not directly saved, but good for context

    const gameDocRef = doc(firestore, 'games', activeGameId);
    
    const gameDataToUpdate: Partial<Game> = {
      gameState: currentBoardState,
      // endTime will be set when the game truly ends (win/loss/quit)
      // result remains 'in-progress' for a manual save
    };

    try {
      await updateDoc(gameDocRef, gameDataToUpdate);
      toast({
        title: "Game Saved!",
        description: "Your game progress has been saved. You can find it in your history.",
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

  const handleQuitGame = async () => {
    if (user && activeGameId && firestore) { // Only update Firestore if user is logged in and game exists
      setIsSaving(true); // Use isSaving to disable buttons during quit operation
      try {
        const gameDocRef = doc(firestore, 'games', activeGameId);
        await updateDoc(gameDocRef, {
          result: 'quit',
          endTime: Timestamp.now(),
          gameState: gameBoardRef.current?.getCurrentBoardState() || "QUIT_STATE_UNKNOWN",
        });
        toast({
          title: "Game Quit",
          description: "Your game has been marked as quit in your history.",
          variant: "default",
        });
      } catch (error) {
        console.error("Error quitting game:", error);
        toast({
          title: "Error Quitting",
          description: "Could not update game status. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsSaving(false);
      }
    }
    setShowBoard(false); 
    setActiveGameId(null); // Clear active game ID on quit
  };

  const handleGameEnd = async (status: 'won' | 'lost' | 'quit', time: number, boardState: string) => {
    if (!user || !activeGameId) { // Only save results for logged-in users with an active game
      if (status === 'won' || status === 'lost') {
        // console.log(`Guest game ended: ${status}, Time: ${time}`);
      }
      return;
    }

    if (!firestore) {
      toast({
        title: "Error",
        description: "Firestore is not available. Cannot save game result.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    const gameDocRef = doc(firestore, 'games', activeGameId);
    const gameResultData: Partial<Game> = {
      endTime: Timestamp.now(),
      result: status as GameResult, // Cast because GameResult includes 'in-progress'
      gameState: boardState, 
      // moves: [], // TODO: Implement move tracking and saving
    };

    try {
      await updateDoc(gameDocRef, gameResultData);
      // Toast is handled by the GameBoard for win/loss dialogs
      // setActiveGameId(null); // Game has ended, clear active game ID
    } catch (error) {
      console.error("Error saving game result:", error);
      toast({
        title: "Save Result Failed",
        description: "Could not save your game result. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
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
              <Select value={selectedDifficultyKey} onValueChange={(value) => setSelectedDifficultyKey(value as DifficultyKey)} disabled={showBoard && gameKey > 0 && !!activeGameId}>
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
            <Button onClick={handleStartGame} className="w-full sm:w-auto mt-4 sm:mt-6 bg-primary hover:bg-primary/90" disabled={isSaving}>
              {showBoard && activeGameId ? 'Start New Game' : 'Start Game'}
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
              <GameBoard 
                key={gameKey} 
                ref={gameBoardRef}
                difficultyKey={selectedDifficultyKey} 
                isGuest={!user}
                onGameEnd={handleGameEnd} 
              />
            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row justify-between gap-2 pt-4">
              <Button variant="outline" onClick={handleRestartGame} className="w-full sm:w-auto" disabled={isSaving}>
                <RotateCcw className="mr-2 h-4 w-4" /> Restart
              </Button>
              <Button 
                variant="secondary" 
                onClick={handleSaveGame} 
                disabled={!user || !activeGameId || isSaving} 
                className="w-full sm:w-auto"
                title={!user ? "Login to save your game" : (!activeGameId ? "Start a game to save" : "Save your current game")}
              >
                <Save className="mr-2 h-4 w-4" /> {isSaving ? "Saving..." : "Save Game"}
              </Button>
              <Button variant="destructive" onClick={handleQuitGame} className="w-full sm:w-auto" disabled={isSaving}>
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
