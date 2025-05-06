
'use client';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import React, { useState, useEffect, useRef, useCallback } from 'react';
import GameBoard, { type GameBoardRef, type InternalGameStatus } from '@/components/minesweeper/GameBoard';
import { DIFFICULTY_LEVELS, type DifficultyKey } from '@/config/minesweeperSettings';
import { useAuth } from '@/hooks/useAuth'; 
import { useRouter } from 'next/navigation';
import { Save, LogOutIcon, RotateCcw } from 'lucide-react';
import { getFirebase } from '@/firebase';
import { doc, setDoc, Timestamp, collection, updateDoc, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Game, GameResult } from '@/lib/firebaseTypes'; 
// import { GameSchema } from '@/lib/firebaseTypes'; // Not used directly here


export default function PlayPage() {
  const [selectedDifficultyKey, setSelectedDifficultyKey] = useState<DifficultyKey>('medium');
  const [gameKey, setGameKey] = useState<number>(0); 
  const [showBoard, setShowBoard] = useState<boolean>(false);
  const { user } = useAuth();
  // const router = useRouter(); // Not used directly
  const { firestore } = getFirebase();
  const { toast } = useToast();
  const [isSavingOrStarting, setIsSavingOrStarting] = useState(false);
  const gameBoardRef = useRef<GameBoardRef>(null);
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const [gameResolved, setGameResolved] = useState(false); // True if game ended via win, loss, or explicit quit button

  // Refs for useEffect cleanup to access latest values without re-triggering effect too often
  const activeGameIdRef = useRef(activeGameId);
  const gameResolvedRef = useRef(gameResolved);

  useEffect(() => {
    activeGameIdRef.current = activeGameId;
  }, [activeGameId]);

  useEffect(() => {
    gameResolvedRef.current = gameResolved;
  }, [gameResolved]);


  const handleStartGame = async () => {
    setIsSavingOrStarting(true);
    setGameResolved(false); // New game is not resolved yet

    if (user && activeGameIdRef.current && firestore) {
      // If there was a previous game in progress (and it wasn't manually resolved), mark it as quit.
      // This handles cases like changing difficulty and starting a new game.
      if (!gameResolvedRef.current) {
        try {
            const gameDocRef = doc(firestore, 'games', activeGameIdRef.current);
            await updateDoc(gameDocRef, {
                result: 'quit',
                endTime: Timestamp.now(),
                gameState: gameBoardRef.current?.getCurrentBoardState() ?? "QUIT_PRE_START",
            });
        } catch (error) {
            console.error("Error marking previous game as quit on new game start:", error);
            toast({ title: "Cleanup Error", description: "Could not update status of previous game.", variant: "destructive" });
        }
      }
    }
    
    if (!user) { // Do not create a game document for guests
        setShowBoard(true);
        setGameKey(prevKey => prevKey + 1);
        setActiveGameId(null); 
        setIsSavingOrStarting(false);
        return;
    }

    if (!firestore) {
      toast({
        title: "Error",
        description: "Firestore is not available. Cannot start a new game.",
        variant: "destructive",
      });
      setIsSavingOrStarting(false);
      return;
    }
    
    // Check for existing 'in-progress' games for the user and mark them as 'quit'
    try {
        const gamesCollectionRef = collection(firestore, 'games');
        const q = query(gamesCollectionRef, where('userId', '==', user.uid), where('result', '==', 'in-progress'));
        const querySnapshot = await getDocs(q);
        const batch = writeBatch(firestore);
        querySnapshot.forEach((gameDoc) => {
            batch.update(gameDoc.ref, { result: 'quit', endTime: Timestamp.now() });
        });
        await batch.commit();
    } catch (error) {
        console.error("Error clearing previous in-progress games:", error);
        // Continue, as this is a cleanup step, not critical for new game start
    }


    setShowBoard(true);
    setGameKey(prevKey => prevKey + 1);
    
    const newGameDocRef = doc(collection(firestore, 'games'));
    setActiveGameId(newGameDocRef.id);

    const gameData: Omit<Game, 'id'> = {
      userId: user.uid,
      startTime: Timestamp.now(),
      endTime: null,
      gameState: "INITIAL_BOARD_STATE", // Placeholder, will be updated by GameBoard or save/quit
      difficulty: DIFFICULTY_LEVELS[selectedDifficultyKey].name,
      moves: [],
      result: 'in-progress',
    };

    try {
      await setDoc(newGameDocRef, gameData);
    } catch (error) {
      console.error("Error creating new game:", error);
      toast({
        title: "Error Starting Game",
        description: "Could not create a new game record. Please try again.",
        variant: "destructive",
      });
      setShowBoard(false);
      setActiveGameId(null);
    } finally {
      setIsSavingOrStarting(false);
    }
  };

  const handleRestartGame = () => {
    // This means the current game (if any) is abandoned without saving to history as 'quit'
    // A new game will be started by handleStartGame, which will overwrite any 'in-progress' server record.
    setGameResolved(true); // Treat restart as a resolution of the current game (prevents quit on unmount)
    handleStartGame(); 
  };
  
  const handleSaveGame = async () => {
    if (!user || !activeGameIdRef.current) { 
      toast({
        title: !user ? "Login Required" : "No Active Game",
        description: !user ? "You need to be logged in to save your game progress." : "No active game to save.",
        variant: "destructive",
      });
      return;
    }
    if (!firestore) {
        toast({ title: "Error", description: "Firestore is not available.", variant: "destructive" });
        return;
    }
    if (!gameBoardRef.current) {
        toast({ title: "Error", description: "Game board is not ready.", variant: "destructive" });
        return;
    }

    setIsSavingOrStarting(true);
    const currentBoardState = gameBoardRef.current.getCurrentBoardState();
    const gameDocRef = doc(firestore, 'games', activeGameIdRef.current);
    
    const gameDataToUpdate: Partial<Game> = {
      gameState: currentBoardState,
      // result remains 'in-progress'
    };

    try {
      await updateDoc(gameDocRef, gameDataToUpdate);
      toast({
        title: "Game Saved!",
        description: "Your game progress has been saved.",
        variant: "default",
      });
    } catch (error) {
      console.error("Error saving game:", error);
      toast({ title: "Save Failed", description: "Could not save your game.", variant: "destructive" });
    } finally {
      setIsSavingOrStarting(false);
    }
  };

  const handleQuitGame = async () => {
    setGameResolved(true); // Explicit quit resolves the game
    if (user && activeGameIdRef.current && firestore) { 
      setIsSavingOrStarting(true);
      try {
        const gameDocRef = doc(firestore, 'games', activeGameIdRef.current);
        await updateDoc(gameDocRef, {
          result: 'quit',
          endTime: Timestamp.now(),
          gameState: gameBoardRef.current?.getCurrentBoardState() || "QUIT_STATE_UNKNOWN",
        });
        toast({ title: "Game Quit", description: "Game marked as quit.", variant: "default" });
      } catch (error) {
        console.error("Error quitting game:", error);
        toast({ title: "Error Quitting", description: "Could not update game status.", variant: "destructive" });
      } finally {
        setIsSavingOrStarting(false);
      }
    }
    setShowBoard(false); 
    setActiveGameId(null); 
  };

  const handleGameEnd = async (status: InternalGameStatus, time: number, boardState: string) => {
    setGameResolved(true); // Win or loss resolves the game
    if (!user || !activeGameIdRef.current) { 
      return;
    }
    if (!firestore) {
      toast({ title: "Error", description: "Firestore not available for saving result.", variant: "destructive" });
      return;
    }

    setIsSavingOrStarting(true);
    const gameDocRef = doc(firestore, 'games', activeGameIdRef.current);
    const gameResultData: Partial<Game> = {
      endTime: Timestamp.now(),
      result: status as GameResult, 
      gameState: boardState, 
    };

    try {
      await updateDoc(gameDocRef, gameResultData);
      // Toasts are handled by GameBoard for win/loss
    } catch (error) {
      console.error("Error saving game result:", error);
      toast({ title: "Save Result Failed", description: "Could not save game result.", variant: "destructive" });
    } finally {
      setIsSavingOrStarting(false);
    }
  };

  // Cleanup on unmount: if a game is active, not resolved, and user is logged in, mark as quit
  useEffect(() => {
    return () => {
      if (user && activeGameIdRef.current && !gameResolvedRef.current && firestore) {
        const gameDocRef = doc(firestore, 'games', activeGameIdRef.current);
        // This is a fire-and-forget, best-effort attempt.
        // `navigator.sendBeacon` could be an alternative for more reliability on page unload,
        // but `updateDoc` is simpler for now and usually works if the navigation isn't too abrupt.
        updateDoc(gameDocRef, {
          result: 'quit',
          endTime: Timestamp.now(),
          gameState: gameBoardRef.current?.getCurrentBoardState() ?? "QUIT_ON_UNMOUNT_UNKNOWN_STATE",
        }).catch(error => console.error("Error marking game as quit on unmount:", error));
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, firestore]); // Dependencies are intentionally limited. We use refs for activeGameId and gameResolved.


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
              <Select 
                value={selectedDifficultyKey} 
                onValueChange={(value) => setSelectedDifficultyKey(value as DifficultyKey)} 
                disabled={showBoard && gameKey > 0 && !!activeGameIdRef.current && !gameResolved} // Disable if game active and not resolved
              >
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
            <Button onClick={handleStartGame} className="w-full sm:w-auto mt-4 sm:mt-6 bg-primary hover:bg-primary/90" disabled={isSavingOrStarting}>
              {showBoard && activeGameIdRef.current && !gameResolved ? 'Start New Game (will quit current)' : 'Start Game'}
            </Button>
          </CardContent>
        </Card>

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
              <Button variant="outline" onClick={handleRestartGame} className="w-full sm:w-auto" disabled={isSavingOrStarting}>
                <RotateCcw className="mr-2 h-4 w-4" /> Restart
              </Button>
              <Button 
                variant="secondary" 
                onClick={handleSaveGame} 
                disabled={!user || !activeGameIdRef.current || isSavingOrStarting || gameResolved} 
                className="w-full sm:w-auto"
                title={!user ? "Login to save your game" : (!activeGameIdRef.current ? "Start a game to save" : (gameResolved ? "Game already ended" : "Save your current game"))}
              >
                <Save className="mr-2 h-4 w-4" /> {isSavingOrStarting ? "Saving..." : "Save Game"}
              </Button>
              <Button variant="destructive" onClick={handleQuitGame} className="w-full sm:w-auto" disabled={isSavingOrStarting || gameResolved} title={gameResolved ? "Game already ended" : "Quit current game"}>
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
