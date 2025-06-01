
'use client';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import GameBoard, { type GameBoardRef, type InternalGameStatus } from '@/components/minesweeper/GameBoard';
import { DIFFICULTY_LEVELS, type DifficultyKey } from '@/config/minesweeperSettings';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { Save, LogOutIcon, RotateCcw } from 'lucide-react';
import { useToast } from '@/components/ui/toaster';
import { getFirebase } from '@/firebase';
import { doc, setDoc, Timestamp, collection, updateDoc, query, where, getDocs, writeBatch, limit, orderBy, deleteDoc } from 'firebase/firestore';
import { arrayUnion, type FieldValue } from 'firebase/firestore'; import type { Game, GameResult } from '@/lib/firebaseTypes';
import { ThemeToggle } from '@/components/ThemeToggle'; // Import ThemeToggle

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const nonJsonGameStates = [
  "INITIAL_BOARD_STATE",
  "QUIT_FOR_NEW_GAME",
  "QUIT_ON_RESTART",
  "QUIT_ON_DIFFICULTY_CHANGE",
  "QUIT_STATE_UNKNOWN",
  "AUTO_QUIT_MULTIPLE_IN_PROGRESS",
];

export default function PlayPage() {
  const [selectedDifficultyKey, setSelectedDifficultyKey] = useState<DifficultyKey>('medium');
  const [gameKey, setGameKey] = useState<number>(0);
  const [showBoard, setShowBoard] = useState<boolean>(false);
  const { user } = useAuth();
  const { firestore } = getFirebase();
  const { toast } = useToast();
  const [isSavingOrStarting, setIsSavingOrStarting] = useState(false);
  const gameBoardRef = useRef<GameBoardRef>(null);
  const router = useRouter();

  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const [gameResolved, setGameResolved] = useState(false);
  const [gameData, setGameData] = useState<Game | null>(null);
  const [hasLoadedGame, setHasLoadedGame] = useState(false); // Tracks if an attempt to load a game for the current user session has been made
  const [gameStatusFromBoard, setGameStatusFromBoard] = useState<string | null>(null);


  const activeGameIdRef = useRef(activeGameId);
  const gameResolvedRef = useRef(gameResolved);
  const gameDataRef = useRef(gameData);

  useEffect(() => {
    activeGameIdRef.current = activeGameId;
  }, [activeGameId]);

  useEffect(() => {
    gameResolvedRef.current = gameResolved;
  }, [gameResolved]);

  useEffect(() => {
    gameDataRef.current = gameData;
  }, [gameData]);


  useEffect(() => {
    if (!user || !firestore) {
      // User logged out or firestore not available. Reset everything.
      if (activeGameIdRef.current) { // Only reset if a game was active
        setGameData(null);
        setActiveGameId(null);
        setShowBoard(false);
        setGameResolved(true);
        setGameStatusFromBoard(null);
        if (gameBoardRef.current) {
          gameBoardRef.current.resetBoardToInitial();
        }
      }
      setHasLoadedGame(false); // Reset for the next user session
      return;
    }

    // If we have a user but no game is currently active in PlayPage's state
    // AND we haven't tried to load for this user session yet.
    if (user && !activeGameIdRef.current && !hasLoadedGame) {
      setHasLoadedGame(true); // Mark that we are attempting to load for this new user session
      const loadExistingGame = async () => {
        setIsSavingOrStarting(true);
        const gamesCollectionRef = collection(firestore, 'games');
        const q = query(
          gamesCollectionRef,
          where('userId', '==', user.uid),
          where('result', '==', 'continue'),
          orderBy('startTime', 'desc'),
          limit(1)
        );

        try {
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const gameDoc = querySnapshot.docs[0];
            const { GameSchema } = require('@/lib/firebaseTypes'); // Keep this scoped if not top-level
            const loadedGame = GameSchema.parse({ id: gameDoc.id, ...gameDoc.data() }) as Game;

            if (loadedGame.result === 'continue') {
              await updateDoc(doc(firestore, 'games', loadedGame.id), { result: 'in-progress' });
              setGameData({ ...loadedGame, result: 'in-progress' });
              const difficultyOfLoadedGame = Object.keys(DIFFICULTY_LEVELS).find(
                key => DIFFICULTY_LEVELS[key as DifficultyKey].name === loadedGame.difficulty
              ) as DifficultyKey | undefined;

              if (difficultyOfLoadedGame) {
                setSelectedDifficultyKey(difficultyOfLoadedGame);
              } else {
                setSelectedDifficultyKey('medium'); // Default if unknown
                toast({ title: "Warning", description: "Loaded game has unknown difficulty, defaulting to medium.", variant: "default" });
              }
              setActiveGameId(loadedGame.id);
              setShowBoard(true); // Show the board for the loaded game
              setGameKey(prevKey => prevKey + 1); // Force re-render of GameBoard with new initial state
              setGameResolved(false); // Game is now active
              toast({ title: "Game Loaded", description: "Your previous in-progress game has been loaded." });
            } else {
              // This case should ideally not happen if the query is for 'continue'
              // If it does, do nothing to avoid resetting an existing 'in-progress' game shown on board
            }
          } else {
            // No 'continue' game found.
            // Only reset if no game is currently considered active by PlayPage.
            if (!activeGameIdRef.current) {
                setGameData(null);
                setActiveGameId(null);
                // setShowBoard(false); // Avoid calling this if a board might be active from a manual start
            }
          }
        } catch (error) {
          console.error("Error loading existing game:", error);
          toast({ title: "Error Loading Game", description: "Could not load your saved game.", variant: "destructive" });
          // Only reset if no game is currently considered active by PlayPage.
          if (!activeGameIdRef.current) {
            setGameData(null);
            setActiveGameId(null);
            // setShowBoard(false); // Avoid calling this if a board might be active from a manual start
          }
        } finally {
          setIsSavingOrStarting(false);
        }
      };
      loadExistingGame();
    }
  }, [user?.uid, firestore, hasLoadedGame, toast]); // Added toast to dependencies due to its usage


  const handleStartGame = async () => {
    setIsSavingOrStarting(true);
    setGameResolved(false); // New game is not resolved yet
    setGameStatusFromBoard('ready'); // Game is ready to be played

    // If a game is already active and user starts a new one (e.g. by changing difficulty and clicking start)
    // the old game should be marked as 'quit'.
    if (user && activeGameIdRef.current && firestore && !gameResolvedRef.current) {
        try {
            const oldGameDocRef = doc(firestore, 'games', activeGameIdRef.current);
            const currentBoardStateForQuit = gameBoardRef.current?.getCurrentBoardState() || "QUIT_FOR_NEW_GAME";
            await updateDoc(oldGameDocRef, {
                result: 'quit',
                endTime: Timestamp.now(),
                gameState: currentBoardStateForQuit
            });
            console.log("Previous game", activeGameIdRef.current, "marked as quit.");
        } catch (error) {
            console.error("Error quitting previous game on new start:", error);
            // Continue starting new game even if old one fails to update
        }
    }
    
    // Reset local state for the new game before setting the board
    setGameData(null); // Clear previous game data
    setActiveGameId(null); // Clear previous active ID
    // Note: gameBoardRef.current.resetBoardToInitial() is implicitly handled by GameBoard's own useEffect or key change

    setShowBoard(true); // Show the board immediately
    setGameKey(prevKey => prevKey + 1); // Force GameBoard to re-mount with fresh state

    if (!user) {
        // For guest users, we don't save to Firestore.
        // GameBoard will initialize itself.
        setActiveGameId(null); // Ensure no stale ID for guest
        setGameData(null); // Ensure no stale data for guest
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

    const newGameDocRef = doc(collection(firestore, 'games'));
    const newGameEntry: Omit<Game, 'id'> & {id: string} = {
      id: newGameDocRef.id, // Store ID locally first
      userId: user.uid,
      startTime: Timestamp.now(),
      endTime: null,
      gameState: "INITIAL_BOARD_STATE", // Will be updated on first move by GameBoard
      difficulty: DIFFICULTY_LEVELS[selectedDifficultyKey].name,
      moves: [],
      result: 'in-progress',
    };

    try {
      // Important: Destructure id out before sending to setDoc
      const { id, ...gameDataForFirestore } = newGameEntry;
      await setDoc(newGameDocRef, gameDataForFirestore);
      
      // Set local state AFTER successful DB write
      setGameData(newGameEntry); 
      setActiveGameId(newGameEntry.id); 
      toast({ title: "New Game Started", description: `Difficulty: ${newGameEntry.difficulty}`});
    } catch (error) {
      console.error("Error creating new game:", error);
      toast({
        title: "Error Starting Game",
        description: "Could not create a new game record. Please try again.",
        variant: "destructive",
      });
      // Rollback local state if DB write fails
      setShowBoard(false);
      setActiveGameId(null);
      setGameData(null);
    } finally {
      setIsSavingOrStarting(false);
    }
  };

  const handleMoveMade = useCallback(async (moveType: 'reveal' | 'flag' | 'unflag', x: number, y: number) => {
    if (!user || !activeGameIdRef.current || !firestore) {
      // console.warn("Attempted to log move without user, active game ID, or firestore.");
      return;
    }

    const gameDocRef = doc(firestore, 'games', activeGameIdRef.current);
    const move = {
      type: moveType, // 'type' might be legacy, 'action' is more descriptive for schema
      action: moveType, 
      x,
      y,
      timestamp: Timestamp.now(),
    };

    try {
      // Update moves array
      await updateDoc(gameDocRef, {
        moves: arrayUnion(move),
      });

      // Get current board state from GameBoard and update gameState in Firestore
      if (gameBoardRef.current) {
        const currentBoardState = gameBoardRef.current.getCurrentBoardState();
        // console.log("Updating game state in Firestore: ", currentBoardState)
        await updateDoc(gameDocRef, {
          gameState: currentBoardState,
          lastSavedTime: Timestamp.now(), // Also update last saved time
        });
      }
    } catch (error) {
      console.error("Error logging move to Firestore:", error);
      // Optionally, inform user if saving move fails, though it might be too noisy
      // toast({ title: "Save Error", description: "Could not save your last move.", variant: "destructive" });
    }
  }, [user, firestore]); // activeGameIdRef is a ref, so it's stable. gameBoardRef is also stable.

  const handleRestartGame = async () => {
    // If a game was in progress and saved, mark it as 'quit' or delete it.
    // For simplicity, let's just delete the old in-progress game record if it exists.
    if (user && activeGameIdRef.current && firestore && !gameResolvedRef.current) {
        try {
            const gameDocRef = doc(firestore, 'games', activeGameIdRef.current);
            const currentBoardStateForQuit = gameBoardRef.current?.getCurrentBoardState() || "QUIT_ON_RESTART";
            await updateDoc(gameDocRef, {
                 result: 'quit', // Mark as quit instead of deleting
                 endTime: Timestamp.now(),
                 gameState: currentBoardStateForQuit
            });
            toast({ title: "Game Restarted", description: "The previous game was marked as quit." });
        } catch (error) {
            console.error("Error quitting previous game on restart:", error);
            toast({ title: "Error", description: "Could not update the previous game status.", variant: "destructive" });
        }
    }

    // Reset local state immediately to prepare for new game
    setGameResolved(false); // New game is not resolved
    setGameData(null);      // Clear old game data
    setActiveGameId(null);  // Clear old game ID
    setGameStatusFromBoard('ready');

    // GameBoard will be reset by handleStartGame through key change or prop update.
    // Trigger a new game start procedure
    await handleStartGame();
  };


  const handleSaveGame = useCallback(async (isAutoSave = false) => {
    if (!user || !activeGameIdRef.current) {
      if (!isAutoSave) {
        toast({
          title: !user ? "Login Required" : "No Active Game",
          description: !user ? "You need to be logged in to save game progress." : "No active game to save.",
          variant: "destructive",
        });
      }
      return;
    }
    if (!firestore || !gameBoardRef.current) {
        if (!isAutoSave) toast({ title: "Error", description: "Cannot save game at the moment.", variant: "destructive" });
        return;
    }
    // Prevent saving if the game is already resolved (won/lost/quit)
    if (gameResolvedRef.current && gameDataRef.current?.result !== 'in-progress') {
        if (!isAutoSave) toast({ title: "Game Ended", description: `Cannot save a game that has already finished with result: ${gameDataRef.current?.result}.`, variant: "default" });
        return;
    }

    setIsSavingOrStarting(true);
    const currentBoardState = gameBoardRef.current.getCurrentBoardState();
    if (!currentBoardState || currentBoardState === "undefined" || nonJsonGameStates.includes(currentBoardState) ) {
        if (!isAutoSave) toast({ title: "Save Error", description: "Invalid board state for saving.", variant: "destructive"});
        setIsSavingOrStarting(false);
        return;
    }


    const gameDocRef = doc(firestore, 'games', activeGameIdRef.current);

    // Ensure startTime is preserved if it exists, otherwise use now (shouldn't happen for active game)
    const startTimeForUpdate = gameDataRef.current?.startTime || Timestamp.now();

    const gameDataToUpdate: Partial<Game> = {
      gameState: currentBoardState,
      result: 'in-progress', // Ensure game is marked as 'in-progress' when saving
      startTime: startTimeForUpdate, // Keep original start time
      difficulty: gameDataRef.current?.difficulty || DIFFICULTY_LEVELS[selectedDifficultyKey].name, // Keep original difficulty
      endTime: null, // Explicitly set endTime to null for in-progress saves
      lastSavedTime: Timestamp.now(),
    };

    // Optimistically update local state first, or wait for DB confirmation?
    // For now, let's update locally to keep UI responsive, then DB.
    setGameData(prev => prev ? {...prev, ...gameDataToUpdate } as Game : null);


    try {
      await updateDoc(gameDocRef, gameDataToUpdate);
      if (!isAutoSave) {
        toast({
          title: "Game Saved!",
          description: "Your game progress has been saved.",
        });
      }
    } catch (error) {
      console.error("Error saving game:", error);
      if (!isAutoSave) toast({ title: "Save Failed", description: "Could not save your game.", variant: "destructive" });
      // Consider rolling back optimistic update or re-fetching if save fails
    } finally {
      setIsSavingOrStarting(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, firestore, selectedDifficultyKey, toast]); // Added selectedDifficultyKey and toast

  const handleQuitGame = async () => {
    if (user && activeGameIdRef.current && firestore && !gameResolvedRef.current) {
      setIsSavingOrStarting(true);
      try {
        const gameDocRef = doc(firestore, 'games', activeGameIdRef.current);
        await updateDoc(gameDocRef, {
          result: 'lost', // Quitting is considered a loss for stats typically
          endTime: Timestamp.now(),
          gameState: gameBoardRef.current?.getCurrentBoardState() || "QUIT_STATE_UNKNOWN", // Save final board state
        });
        toast({ title: "Game Surrendered", description: "Game marked as lost and progress saved." });
      } catch (error) {
        console.error("Error quitting game:", error);
        toast({ title: "Error Quitting", description: "Could not update game status.", variant: "destructive" });
      } finally {
        setIsSavingOrStarting(false);
      }
    }
    // Reset local state after attempting to save quit status
    setGameResolved(true); // Game is now resolved
    setShowBoard(false); // Hide the board
    setActiveGameId(null); // No active game
    setGameData(null); // Clear game data
    setHasLoadedGame(false); // Allow re-loading a 'continue' game if user navigates away and back
    setGameStatusFromBoard('quit'); // Reflect the quit status
  };

  const handleGameEnd = async (status: InternalGameStatus, time: number, boardState: string) => {
    setGameStatusFromBoard(status); // Update status from GameBoard
    // console.log("handleGameEnd called with:", { status, time, boardState, user, activeGameId: activeGameIdRef.current, gameData: gameDataRef.current });
    setGameResolved(true); // Mark game as resolved
    if (!user || !activeGameIdRef.current) {
      // Handle guest game end or scenario where game ID is missing
      if (status === 'quit') {
        // If it was a quit action from GameBoard (e.g. via a dialog there, though not current design)
        // We might want to mirror some of handleQuitGame logic here for guests.
      }
      return; // No save for guests or if no active game ID
    }
    if (!firestore) {
      toast({ title: "Error", description: "Firestore not available for saving result.", variant: "destructive" });
      return;
    }

    setIsSavingOrStarting(true);
    const gameDocRef = doc(firestore, 'games', activeGameIdRef.current);

    const finalGameData: Partial<Game> = {
      endTime: Timestamp.now(),
      result: status as GameResult, // 'won' or 'lost'
      gameState: boardState, // Final board state from GameBoard
      // Ensure startTime and difficulty are preserved from the current gameData
      startTime: gameDataRef.current?.startTime || Timestamp.now(), // Fallback, but should exist
      difficulty: gameDataRef.current?.difficulty || DIFFICULTY_LEVELS[selectedDifficultyKey].name, // Fallback
    };

    // console.log("Final game data to save:", finalGameData);

    // Optimistically update local state
    setGameData(prev => prev ? {...prev, ...finalGameData} : null);

    try {
      await updateDoc(gameDocRef, finalGameData);
      // Toast for game end is handled by GameBoard's dialog now
    } catch (error) {
      console.error("Error saving game result:", error);
      toast({ title: "Save Result Failed", description: "Could not save game result.", variant: "destructive" });
    } finally {
      setIsSavingOrStarting(false);
      // Do NOT setHasLoadedGame(false) here, as the user is still in the same session.
      // They might want to start a new game.
    }
  };

  // Auto-save and beforeunload handling
  const handleBeforeUnload = useCallback((event: BeforeUnloadEvent) => {
      if (user && activeGameIdRef.current && !gameResolvedRef.current && firestore && gameBoardRef.current) {
        // Standard way to prompt user, though modern browsers might override the message
        event.preventDefault();
        event.returnValue = 'You have an unsaved game in progress. Are you sure you want to leave?';
        // Attempt a synchronous save if possible, though this is unreliable
        // For a more robust solution, frequent auto-saves are better.
        // handleSaveGame(true); // Not ideal here, relying on auto-save interval instead.
      }
    }, [user, firestore]); // Removed handleSaveGame to avoid direct call here

  useEffect(() => {
    const autoSaveInterval = setInterval(() => {
      if (user && activeGameIdRef.current && !gameResolvedRef.current && firestore && gameBoardRef.current) {
        // Only auto-save if a game is actively being played and not yet resolved.
        // console.log("Attempting auto-save for game:", activeGameIdRef.current);
        handleSaveGame(true); // Pass true for isAutoSave
      }
    }, 30000); // Auto-save every 30 seconds

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(autoSaveInterval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Potentially save one last time if game is in progress
      if (user && activeGameIdRef.current && !gameResolvedRef.current && firestore && gameBoardRef.current) {
        // This final save on unmount can be problematic and might be better handled by relying on the last auto-save.
        // handleSaveGame(true); // Consider if this is needed or too risky.
      }
    };
  }, [user, firestore, handleSaveGame, handleBeforeUnload]);


  const difficultyConfig = DIFFICULTY_LEVELS[selectedDifficultyKey] || DIFFICULTY_LEVELS['medium'];

  // Determine initialBoardState for GameBoard component
  // Pass gameData.gameState if it's a valid JSON board state, regardless of game result,
  // to allow GameBoard to display final states for 'won'/'lost' games.
  const boardInitialState = (gameData?.gameState && !nonJsonGameStates.includes(gameData.gameState))
    ? gameData.gameState
    : undefined;


  const timeToRestore = (gameData?.result === 'in-progress' || gameData?.result === 'continue') && gameData.startTime && gameBoardRef.current
    ? gameBoardRef.current.calculateTimeFromStart(gameData.startTime)
    : (gameData?.endTime && gameData?.startTime ? Math.round((gameData.endTime.toDate().getTime() - gameData.startTime.toDate().getTime())/1000) : 0);


  return (
    <AppLayout>
      <div className="container mx-auto p-4 md:p-8 flex flex-col items-center">
        <h1 className="text-3xl font-bold text-foreground mb-8">Play MineVerse</h1>
        <Card className="w-full max-w-3xl mb-8">
          <CardHeader>
            <CardTitle>Game Setup</CardTitle>
            <CardDescription>Choose difficulty to start a new game, or resume an existing one.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row items-center sm:items-baseline gap-4">
              <Label htmlFor="difficulty-select">Difficulty</Label>
              <Select
                value={selectedDifficultyKey}
                onValueChange={async (value) => {
                    // If a game is active, changing difficulty should quit it.
                    if (user && activeGameIdRef.current && !gameResolvedRef.current && firestore) {
                       try {
                            const gameDocRef = doc(firestore, 'games', activeGameIdRef.current);
                            await updateDoc(gameDocRef, {
                                result: 'quit',
                                endTime: Timestamp.now(),
                                gameState: gameBoardRef.current?.getCurrentBoardState() || "QUIT_ON_DIFFICULTY_CHANGE"
                            });
                            // toast({title: "Game Quit", description: "Changed difficulty, previous game marked as quit."}) // Can be noisy
                       } catch (err) {
                            console.error("Error quitting game on difficulty change:", err);
                            toast({title: "Error", description: "Failed to quit previous game.", variant: "destructive"});
                       }
                    }
                    // Reset game state for new difficulty
                    setActiveGameId(null);
                    setGameData(null);
                    setShowBoard(false); // Hide board until new game is started
                    setGameResolved(true); // No active game to be resolved
                    setGameStatusFromBoard(null);
                    setSelectedDifficultyKey(value as DifficultyKey);
                    // The actual new game starts when user clicks "Start Game"
                }}                
                disabled={isSavingOrStarting} // Only disable if actively saving/starting, allow change if game is on board
              >
                <SelectTrigger id="difficulty-select" className="w-full" title="Select difficulty">
                  <SelectValue placeholder="Select difficulty" />
                </SelectTrigger>
                <SelectContent id="difficulty-select-content">
                  {Object.keys(DIFFICULTY_LEVELS).map(key => (
                    <SelectItem key={key} value={key}>
                      {DIFFICULTY_LEVELS[key as DifficultyKey].name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handleStartGame}
                className="w-full sm:w-auto bg-primary hover:bg-primary/90"
                disabled={isSavingOrStarting}
                 title={
                    (showBoard && activeGameIdRef.current && !gameResolvedRef.current && user && gameData?.difficulty === DIFFICULTY_LEVELS[selectedDifficultyKey].name)
                    ? "A game is in progress. Click Restart or Surrender first, or change difficulty to start a new one."
                    : "Start a new game with the selected difficulty"
                }
            >
              {/* Text changes based on whether a game is active with SAME difficulty */}
              {(showBoard && activeGameIdRef.current && !gameResolvedRef.current && user && gameData?.difficulty === DIFFICULTY_LEVELS[selectedDifficultyKey].name)
                ? 'Restart Current' // Or some other indication that it's the same game
                : 'Start Game'}
            </Button>
          </CardContent>
        </Card>


        {showBoard ? (
          <Card className="w-full max-w-3xl">
            <CardHeader>
              <CardTitle>
                MineVerse Board - {DIFFICULTY_LEVELS[selectedDifficultyKey].name}
                {activeGameIdRef.current && user && <span className="text-xs text-muted-foreground ml-2">(ID: {activeGameIdRef.current.substring(0,6)})</span>}
              </CardTitle>
            </CardHeader>

            <CardContent className="p-0 sm:p-2 md:p-4">
              <GameBoard
                key={gameKey} // This key change forces GameBoard to re-initialize
                ref={gameBoardRef}
                difficultyKey={selectedDifficultyKey}
                isGuest={!user}
                onGameEnd={handleGameEnd}
                initialBoardState={boardInitialState} // Pass the potentially loaded board state
                initialTimeElapsed={timeToRestore} // Pass the potentially loaded time
                onMoveMade={handleMoveMade} 
                activeGameId={activeGameId} // Pass active game ID
                reviewMode={false} // Not in review mode here
              />
            </CardContent>

            <CardFooter className="flex flex-col sm:flex-row justify-around gap-2 pt-4">
              <Button variant="outline" onClick={handleRestartGame} className="w-full sm:w-auto" disabled={isSavingOrStarting}>
                <RotateCcw className="mr-2 h-4 w-4" /> Restart
              </Button>
              <Button
                variant="destructive"
                onClick={handleQuitGame}
                className="w-full sm:w-auto"
                disabled={isSavingOrStarting || (gameResolvedRef.current && gameData?.result !== 'in-progress')}
                title={gameResolvedRef.current && gameData?.result !== 'in-progress' ? "Game already ended" : "Surrendering will mark this game as a loss in your match history."}
              >
                 <LogOutIcon className="mr-2 h-4 w-4" /> Surrender Game
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
                <p className="text-center">
                {user && isSavingOrStarting && !hasLoadedGame && !showBoard
                ? "Loading your game..."
                : "Select difficulty and click \"Start Game\" to begin."
                }
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

    