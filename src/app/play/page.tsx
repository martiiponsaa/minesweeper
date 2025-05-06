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
import { doc, setDoc, Timestamp, collection, updateDoc, query, where, getDocs, writeBatch, limit, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Game, GameResult } from '@/lib/firebaseTypes'; 
import { GameSchema } from '@/lib/firebaseTypes';

const nonJsonGameStates = [
  "INITIAL_BOARD_STATE",
  "QUIT_FOR_NEW_GAME",
  "QUIT_ON_RESTART",
  "QUIT_ON_DIFFICULTY_CHANGE",
  "QUIT_STATE_UNKNOWN",
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
  
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const [gameResolved, setGameResolved] = useState(false); 
  const [gameData, setGameData] = useState<Game | null>(null); // Holds the current game object (new or loaded)
  const [hasLoadedGame, setHasLoadedGame] = useState(false); // Tracks if initial load attempt has been made


  const activeGameIdRef = useRef(activeGameId);
  const gameResolvedRef = useRef(gameResolved);
  const gameDataRef = useRef(gameData); // Ref for gameData for cleanup

  useEffect(() => {
    activeGameIdRef.current = activeGameId;
  }, [activeGameId]);

  useEffect(() => {
    gameResolvedRef.current = gameResolved;
  }, [gameResolved]);

  useEffect(() => {
    gameDataRef.current = gameData;
  }, [gameData]);


    // Effect for handling user changes (login/logout)
    useEffect(() => {
        if (!user || !firestore) {
            // If user logs out or firestore not available, clear any game state
            // that might be tied to a logged-in user.
            // This also handles the case where a guest was playing, then logs in.
            // Or a user was playing, then logs out.
            
            setGameData(null); // Clear any loaded game data
            setActiveGameId(null); // No active game for guest or if logged out
            setShowBoard(false); // Hide board
            setHasLoadedGame(false); // Reset load attempt flag for next user/session
            setGameResolved(true); // Consider any previous game resolved
            
            // If GameBoard instance exists, tell it to reset to its default initial state
            // This is important if the user logs out while a game is displayed.
            if (gameBoardRef.current) {
                gameBoardRef.current.resetBoardToInitial();
            }
            return; // Stop further processing in this effect
        }
        
        // If user is now logged in, and we haven't tried to load a game yet for this session/user
        if (user && !hasLoadedGame) {
            setHasLoadedGame(true); // Mark that we are attempting to load
            const loadExistingGame = async () => {
                setIsSavingOrStarting(true); // Indicate loading activity
                const gamesCollectionRef = collection(firestore, 'games');
                const q = query(
                    gamesCollectionRef,
                    where('userId', '==', user.uid),
                    where('result', '==', 'in-progress'),
                    orderBy('startTime', 'desc'),
                    limit(1)
                );

                try {
                    const querySnapshot = await getDocs(q);
                    if (!querySnapshot.empty) {
                        const gameDoc = querySnapshot.docs[0];
                        const loadedGame = GameSchema.parse({ id: gameDoc.id, ...gameDoc.data() }) as Game;
                        
                        setGameData(loadedGame);
                        const difficultyOfLoadedGame = Object.keys(DIFFICULTY_LEVELS).find(
                            key => DIFFICULTY_LEVELS[key as DifficultyKey].name === loadedGame.difficulty
                        ) as DifficultyKey | undefined;

                        if (difficultyOfLoadedGame) {
                            setSelectedDifficultyKey(difficultyOfLoadedGame);
                        } else {
                            // Fallback if difficulty name doesn't match known keys
                            setSelectedDifficultyKey('medium'); 
                            toast({ title: "Warning", description: "Loaded game has unknown difficulty, defaulting to medium.", variant: "default" });
                        }
                        
                        setActiveGameId(loadedGame.id);
                        setShowBoard(true);
                        setGameKey(prevKey => prevKey + 1); 
                        setGameResolved(false);
                        toast({ title: "Game Loaded", description: "Your previous in-progress game has been loaded." });
                    } else {
                        // No in-progress game found, ensure states are clean for a new game
                        setGameData(null);
                        setActiveGameId(null);
                        setShowBoard(false);
                    }
                } catch (error) {
                    console.error("Error loading existing game:", error);
                    toast({ title: "Error Loading Game", description: "Could not load your saved game.", variant: "destructive" });
                    setGameData(null);
                    setActiveGameId(null);
                    setShowBoard(false);
                } finally {
                    setIsSavingOrStarting(false);
                }
            };
            loadExistingGame();
        } else if (!user && hasLoadedGame) {
            // This case implies user was logged in, loaded a game (or attempted), then logged out.
            // The !user check at the start of this effect should handle clearing state.
            // If we reach here, it means `hasLoadedGame` was true from a previous user session,
            // and now user is null. We need to reset `hasLoadedGame` for the guest session.
            setHasLoadedGame(false);
        }

    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, firestore]); // Only re-run if user or firestore instance changes. `hasLoadedGame` controls internal logic.


  const handleStartGame = async () => {
    setIsSavingOrStarting(true);
    setGameResolved(false); 
    setGameData(null); // Clear any previously loaded game data for a fresh start

    // If a logged-in user had an active game, mark it as 'quit' before starting a new one.
    // This covers scenarios like changing difficulty and clicking "Start New Game"
    // or explicitly starting a new game while another was loaded/active.
    if (user && activeGameIdRef.current && firestore && !gameResolvedRef.current) {
      try {
          const gameDocRef = doc(firestore, 'games', activeGameIdRef.current);
          await updateDoc(gameDocRef, {
              result: 'quit',
              endTime: Timestamp.now(),
              gameState: gameBoardRef.current?.getCurrentBoardState() ?? "QUIT_FOR_NEW_GAME",
          });
      } catch (error) {
          console.error("Error marking previous game as quit on new game start:", error);
      }
    }
    
    setShowBoard(true);
    setGameKey(prevKey => prevKey + 1); 
    
    if (!user) { 
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
    
    // Double-check and ensure any other 'in-progress' games for this user are marked 'quit'.
    // This is a safety net.
    try {
        const gamesCollectionRef = collection(firestore, 'games');
        const q = query(gamesCollectionRef, where('userId', '==', user.uid), where('result', '==', 'in-progress'));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            const batch = writeBatch(firestore);
            querySnapshot.forEach((gameDoc) => {
                batch.update(gameDoc.ref, { result: 'quit', endTime: Timestamp.now() });
            });
            await batch.commit();
        }
    } catch (error) {
        console.error("Error clearing other in-progress games on new game start:", error);
    }

    const newGameDocRef = doc(collection(firestore, 'games'));
    setActiveGameId(newGameDocRef.id);

    const newGameEntry: Omit<Game, 'id'> = {
      userId: user.uid,
      startTime: Timestamp.now(),
      endTime: null,
      gameState: "INITIAL_BOARD_STATE", 
      difficulty: DIFFICULTY_LEVELS[selectedDifficultyKey].name,
      moves: [],
      result: 'in-progress',
    };
    setGameData({ ...newGameEntry, id: newGameDocRef.id}); 

    try {
      await setDoc(newGameDocRef, newGameEntry);
    } catch (error) {
      console.error("Error creating new game:", error);
      toast({
        title: "Error Starting Game",
        description: "Could not create a new game record. Please try again.",
        variant: "destructive",
      });
      setShowBoard(false);
      setActiveGameId(null);
      setGameData(null);
    } finally {
      setIsSavingOrStarting(false);
    }
  };

  const handleRestartGame = () => {
    setGameResolved(true); 
    if (user && activeGameIdRef.current && firestore && !gameResolvedRef.current) {
        const gameDocRef = doc(firestore, 'games', activeGameIdRef.current);
        updateDoc(gameDocRef, {
            result: 'quit', // Mark as quit, but this won't be shown in history for restarts
            // We don't set endTime, as it's a restart not a quit for history purposes
            // Or, if we want to avoid saving restarted (quit) games in history at all,
            // we might even delete this document or skip updating it.
            // For now, let's assume a 'quit' here helps ensure only one 'in-progress'.
            // But this specific 'quit' status is more of an internal state before a new game.
            gameState: gameBoardRef.current?.getCurrentBoardState() ?? "QUIT_ON_RESTART",
        }).catch(error => console.error("Error marking game as quit on restart:", error));
    }
    setGameData(null); 
    // `handleStartGame` will now correctly set up a new game, 
    // and because `gameData` is null, it won't try to load from it.
    // It will also correctly handle marking any genuinely 'in-progress' game as 'quit'.
    handleStartGame(); 
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
    if (gameResolvedRef.current) { 
        if (!isAutoSave) toast({ title: "Game Ended", description: "Cannot save a game that has already finished.", variant: "info" });
        return;
    }

    setIsSavingOrStarting(true);
    const currentBoardState = gameBoardRef.current.getCurrentBoardState();
    // const currentTime = gameBoardRef.current.getCurrentTimeElapsed(); // Time is managed by GameBoard now
    const gameDocRef = doc(firestore, 'games', activeGameIdRef.current);
    
    // Make sure we use the startTime from the currently active gameData, if it exists
    const startTimeForUpdate = gameDataRef.current?.startTime || Timestamp.now();

    const gameDataToUpdate: Partial<Game> = {
      gameState: currentBoardState,
      result: 'in-progress', // Ensure it's marked as in-progress
      startTime: startTimeForUpdate, // Preserve original start time
      difficulty: DIFFICULTY_LEVELS[selectedDifficultyKey].name, // Save current difficulty
      // endTime remains null for in-progress games
    };
    
    setGameData(prev => prev ? {...prev, ...gameDataToUpdate } : null);

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
    } finally {
      setIsSavingOrStarting(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, firestore, selectedDifficultyKey, toast]); // activeGameIdRef, gameResolvedRef, gameDataRef used via refs

  const handleQuitGame = async () => {
    setGameResolved(true); 
    if (user && activeGameIdRef.current && firestore) { 
      setIsSavingOrStarting(true);
      try {
        const gameDocRef = doc(firestore, 'games', activeGameIdRef.current);
        await updateDoc(gameDocRef, {
          result: 'quit',
          endTime: Timestamp.now(),
          gameState: gameBoardRef.current?.getCurrentBoardState() || "QUIT_STATE_UNKNOWN",
        });
        toast({ title: "Game Quit", description: "Game marked as quit." });
      } catch (error) {
        console.error("Error quitting game:", error);
        toast({ title: "Error Quitting", description: "Could not update game status.", variant: "destructive" });
      } finally {
        setIsSavingOrStarting(false);
      }
    }
    setShowBoard(false); 
    setActiveGameId(null); 
    setGameData(null);
    setHasLoadedGame(false); // Allow reloading/new game next time
  };

  const handleGameEnd = async (status: InternalGameStatus, time: number, boardState: string) => {
    setGameResolved(true); 
    if (!user || !activeGameIdRef.current) { 
      // For guests, or if somehow no active game ID, just clear local state
      setShowBoard(false); 
      setActiveGameId(null);
      setGameData(null);
      setHasLoadedGame(false); // Allow new game next time for guest or if error occurred
      return;
    }
    if (!firestore) {
      toast({ title: "Error", description: "Firestore not available for saving result.", variant: "destructive" });
      return;
    }

    setIsSavingOrStarting(true);
    const gameDocRef = doc(firestore, 'games', activeGameIdRef.current);
    
    const finalGameData: Partial<Game> = {
      endTime: Timestamp.now(),
      result: status as GameResult, 
      gameState: boardState,
      // Ensure startTime and difficulty are preserved from the gameData object
      // If gameData is somehow null here (shouldn't be for logged-in user with activeGameId),
      // then it falls back to current time/difficulty, but this path is less likely.
      startTime: gameDataRef.current?.startTime || Timestamp.now(), 
      difficulty: gameDataRef.current?.difficulty || DIFFICULTY_LEVELS[selectedDifficultyKey].name,
      // moves: gameDataRef.current?.moves // Assuming moves are updated within GameBoard and saved via boardState
    };
    
    // Optimistically update local gameData state
    setGameData(prev => prev ? {...prev, ...finalGameData} : null);

    try {
      await updateDoc(gameDocRef, finalGameData);
      // Toast for game end (win/loss) could be handled here or by GameBoard's dialog
    } catch (error) {
      console.error("Error saving game result:", error);
      toast({ title: "Save Result Failed", description: "Could not save game result.", variant: "destructive" });
    } finally {
      setIsSavingOrStarting(false);
      // After game ends (win/loss), we should allow a new game to be loaded or started without
      // trying to resume this one.
      setHasLoadedGame(false); 
      // activeGameId will be cleared if user quits or starts a new game.
      // For a win/loss, activeGameId might remain until a new action.
    }
  };

  // Auto-save on page unload/navigation for logged-in users with an active, unresolved game
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (user && activeGameIdRef.current && !gameResolvedRef.current && firestore && gameBoardRef.current) {
        // Standard way to try and prevent immediate unload for sync operations is not reliable for async.
        // For true reliability, navigator.sendBeacon would be used, but it's for simple POST requests.
        // We'll attempt an async save. It's best-effort.
        // event.preventDefault(); // This can show a browser dialog, often not desired for auto-save
        // event.returnValue = ''; // For older browsers
        handleSaveGame(true); // Attempt auto-save
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Also attempt save on component unmount (e.g., navigating away within SPA)
      if (user && activeGameIdRef.current && !gameResolvedRef.current && firestore && gameBoardRef.current) {
         handleSaveGame(true);
      }
    };
  }, [user, firestore, handleSaveGame]); // handleSaveGame is memoized with useCallback

  const difficultyConfig = DIFFICULTY_LEVELS[selectedDifficultyKey] || DIFFICULTY_LEVELS['medium'];

  const boardInitialState = gameData?.gameState && !nonJsonGameStates.includes(gameData.gameState)
    ? gameData.gameState
    : undefined;


  return (
    <AppLayout>
      <div className="container mx-auto p-4 md:p-8 flex flex-col items-center">
        <h1 className="text-3xl font-bold text-foreground mb-8">Play MineVerse</h1>

        <Card className="w-full max-w-3xl mb-8">
          <CardHeader>
            <CardTitle>Game Setup</CardTitle>
            <CardDescription>Choose difficulty to start a new game, or resume an existing one.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-1 w-full sm:w-auto">
              <Label htmlFor="difficulty-select">Difficulty</Label>
              <Select 
                value={selectedDifficultyKey} 
                onValueChange={(value) => {
                    // If a game is active for a logged-in user and difficulty changes,
                    // mark current game as quit before changing state.
                    if (user && activeGameIdRef.current && !gameResolvedRef.current && firestore) {
                        const gameDocRef = doc(firestore, 'games', activeGameIdRef.current);
                        updateDoc(gameDocRef, { result: 'quit', endTime: Timestamp.now(), gameState: gameBoardRef.current?.getCurrentBoardState() || "QUIT_ON_DIFFICULTY_CHANGE" })
                            .then(() => {
                                setActiveGameId(null); // Clear active game ID
                                setGameData(null);    // Clear game data
                            })
                            .catch(err => console.error("Error quitting game on difficulty change:", err));
                    }
                    setSelectedDifficultyKey(value as DifficultyKey);
                    setShowBoard(false); // Hide board to force re-render with new difficulty settings
                    setGameResolved(true); // Mark previous game as resolved (even if quit)
                    setGameData(null); // Ensure no old game data is used if difficulty changes then new game starts
                }} 
                disabled={isSavingOrStarting || (showBoard && !!activeGameIdRef.current && !gameResolvedRef.current && user && !DIFFICULTY_LEVELS[selectedDifficultyKey].name.includes(gameData?.difficulty || "---"))}
                title={ (showBoard && !!activeGameIdRef.current && !gameResolvedRef.current && user && !DIFFICULTY_LEVELS[selectedDifficultyKey].name.includes(gameData?.difficulty || "---")) ? "Change difficulty and click 'Start New Game' to switch." : "Select difficulty"}
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
            <Button 
                onClick={handleStartGame} 
                className="w-full sm:w-auto mt-4 sm:mt-6 bg-primary hover:bg-primary/90" 
                // Disable if saving, or if board shown, game active, unresolved, user exists, AND current gameData difficulty matches selected (meaning game is already running with this setting)
                disabled={isSavingOrStarting || (showBoard && activeGameIdRef.current && !gameResolvedRef.current && user && gameData?.difficulty === DIFFICULTY_LEVELS[selectedDifficultyKey].name)}
                title={
                    (showBoard && activeGameIdRef.current && !gameResolvedRef.current && user && gameData?.difficulty === DIFFICULTY_LEVELS[selectedDifficultyKey].name)
                    ? "Game already in progress with this difficulty. Choose 'Restart' or 'Quit'." 
                    : (showBoard && activeGameIdRef.current && !gameResolvedRef.current && user ? 'Start New Game (will quit current)' : 'Start Game')
                }
            >
              {/* Logic for button text: if a game is active and its difficulty matches current selection, it's effectively a "Current Game".
                  If difficulties DON'T match, it implies starting new will quit the old one with different difficulty. */}
              {(showBoard && activeGameIdRef.current && !gameResolvedRef.current && user && gameData?.difficulty !== DIFFICULTY_LEVELS[selectedDifficultyKey].name) 
                ? 'Start New (different difficulty)' 
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
                key={gameKey} 
                ref={gameBoardRef}
                difficultyKey={selectedDifficultyKey} 
                isGuest={!user}
                onGameEnd={handleGameEnd}
                initialBoardState={boardInitialState} 
                initialTimeElapsed={
                    // Only provide initialTimeElapsed if it's a loaded 'in-progress' game
                    // and gameData exists with a valid startTime
                    gameData?.result === 'in-progress' && gameData.startTime 
                    ? Math.max(0, Math.floor((Timestamp.now().seconds - gameData.startTime.seconds))) // Ensure non-negative
                    : 0
                }
              />
            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row justify-between gap-2 pt-4">
              <Button variant="outline" onClick={handleRestartGame} className="w-full sm:w-auto" disabled={isSavingOrStarting}>
                <RotateCcw className="mr-2 h-4 w-4" /> Restart
              </Button>
              <Button 
                variant="secondary" 
                onClick={() => handleSaveGame(false)} 
                disabled={!user || !activeGameIdRef.current || isSavingOrStarting || gameResolvedRef.current} 
                className="w-full sm:w-auto"
                title={!user ? "Login to save your game" : (!activeGameIdRef.current ? "Start a game to save" : (gameResolvedRef.current ? "Game already ended" : "Save your current game"))}
              >
                <Save className="mr-2 h-4 w-4" /> {isSavingOrStarting && activeGameIdRef.current ? "Saving..." : "Save Game"}
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleQuitGame} 
                className="w-full sm:w-auto" 
                disabled={isSavingOrStarting || gameResolvedRef.current} 
                title={gameResolvedRef.current ? "Game already ended" : "Quit current game (progress might be auto-saved)"}
              >
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
                <p className="text-center">
                    {user && isSavingOrStarting && !showBoard ? "Loading your game..." : // Changed condition from !hasLoadedGame to isSavingOrStarting for loading text
                     (user && gameData && gameData.result === 'in-progress' && !showBoard) ? "An in-progress game was found but not displayed. Try selecting its difficulty and starting again, or check history." :
                     "Select difficulty and click \"Start Game\" to begin."}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
