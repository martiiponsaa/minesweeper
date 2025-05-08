
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
import { doc, setDoc, Timestamp, collection, updateDoc, query, where, getDocs, writeBatch, limit, orderBy, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Game, GameResult } from '@/lib/firebaseTypes'; 
import { GameSchema } from '@/lib/firebaseTypes';

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
  
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const [gameResolved, setGameResolved] = useState(false); 
  const [gameData, setGameData] = useState<Game | null>(null); 
  const [hasLoadedGame, setHasLoadedGame] = useState(false); 


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
            setGameData(null); 
            setActiveGameId(null); 
            setShowBoard(false); 
            setHasLoadedGame(false); 
            setGameResolved(true); 
            if (gameBoardRef.current) {
                gameBoardRef.current.resetBoardToInitial();
            }
            return; 
        }
        
        if (user && !hasLoadedGame) {
            setHasLoadedGame(true); 
            const loadExistingGame = async () => {
                setIsSavingOrStarting(true); 
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
                            setSelectedDifficultyKey('medium'); 
                            toast({ title: "Warning", description: "Loaded game has unknown difficulty, defaulting to medium.", variant: "default" });
                        }
                        
                        setActiveGameId(loadedGame.id);
                        setShowBoard(true);
                        setGameKey(prevKey => prevKey + 1); 
                        setGameResolved(false);
                        toast({ title: "Game Loaded", description: "Your previous in-progress game has been loaded." });
                    } else {
                        setGameData(null);
                        setActiveGameId(null);
                        setShowBoard(false); // Ensure board is hidden if no game is loaded
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
            setHasLoadedGame(false);
        }

    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, firestore]); 


  const handleStartGame = async () => {
    setIsSavingOrStarting(true);
    setGameResolved(false); 
    setGameData(null); 

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
    
    try {
        const gamesCollectionRef = collection(firestore, 'games');
        const q = query(gamesCollectionRef, where('userId', '==', user.uid), where('result', '==', 'in-progress'));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            const batch = writeBatch(firestore);
            querySnapshot.forEach((gameDoc) => {
                batch.update(gameDoc.ref, { result: 'quit', endTime: Timestamp.now(), gameState: "AUTO_QUIT_MULTIPLE_IN_PROGRESS" });
            });
            await batch.commit();
        }
    } catch (error) {
        console.error("Error clearing other in-progress games on new game start:", error);
    }

    const newGameDocRef = doc(collection(firestore, 'games'));
    setActiveGameId(newGameDocRef.id);

    const newGameEntry: Omit<Game, 'id'> & {id: string} = {
      id: newGameDocRef.id,
      userId: user.uid,
      startTime: Timestamp.now(),
      endTime: null,
      gameState: "INITIAL_BOARD_STATE", 
      difficulty: DIFFICULTY_LEVELS[selectedDifficultyKey].name,
      moves: [],
      result: 'in-progress',
    };
    setGameData(newGameEntry); 

    try {
      // Firestore setDoc expects data without the id field for the document data part
      const { id, ...gameDataForFirestore } = newGameEntry;
      await setDoc(newGameDocRef, gameDataForFirestore);
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

  const handleRestartGame = async () => {
    if (user && activeGameIdRef.current && firestore) {
        // If the current game (activeGameIdRef.current) was loaded and is now being restarted,
        // delete its entry from Firestore.
        try {
            const gameDocRef = doc(firestore, 'games', activeGameIdRef.current);
            await deleteDoc(gameDocRef);
            toast({ title: "Game Restarted", description: "The previous in-progress game instance was removed from history." });
            console.log("Previous in-progress game deleted on restart.");
        } catch (error) {
            console.error("Error deleting previous game on restart:", error);
            toast({ title: "Error", description: "Could not remove the previous game instance from history.", variant: "destructive" });
        }
    }
    
    setGameResolved(false); 
    setGameData(null); 
    setActiveGameId(null); 

    if (gameBoardRef.current) {
      gameBoardRef.current.resetBoardToInitial();
    }
    
    // setShowBoard(true); // handleStartGame will set this
    // setGameKey(prevKey => prevKey + 1); // handleStartGame will set this
    
    // Start a new game, which will create a new Firestore entry
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
    if (gameResolvedRef.current) { 
        if (!isAutoSave) toast({ title: "Game Ended", description: "Cannot save a game that has already finished.", variant: "destructive" });
        return;
    }

    setIsSavingOrStarting(true);
    const currentBoardState = gameBoardRef.current.getCurrentBoardState();
    // const currentTimeElapsed = gameBoardRef.current.getCurrentTimeElapsed(); 

    const gameDocRef = doc(firestore, 'games', activeGameIdRef.current);
    
    const startTimeForUpdate = gameDataRef.current?.startTime || Timestamp.now();

    const gameDataToUpdate: Partial<Game> = {
      gameState: currentBoardState,
      result: 'in-progress', 
      startTime: startTimeForUpdate, 
      difficulty: DIFFICULTY_LEVELS[selectedDifficultyKey].name, 
      endTime: null, // Explicitly set endTime to null for in-progress saves
      lastSavedTime: Timestamp.now(),
    };
    
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
    } finally {
      setIsSavingOrStarting(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, firestore, selectedDifficultyKey, toast]);

  const handleQuitGame = async () => {
    if (user && activeGameIdRef.current && firestore && !gameResolvedRef.current) { 
      setIsSavingOrStarting(true);
      try {
        const gameDocRef = doc(firestore, 'games', activeGameIdRef.current);
        await updateDoc(gameDocRef, {
          result: 'quit',
          endTime: Timestamp.now(),
          gameState: gameBoardRef.current?.getCurrentBoardState() || "QUIT_STATE_UNKNOWN",
        });
        toast({ title: "Game Quit", description: "Game marked as quit and progress saved." });
      } catch (error) {
        console.error("Error quitting game:", error);
        toast({ title: "Error Quitting", description: "Could not update game status.", variant: "destructive" });
      } finally {
        setIsSavingOrStarting(false);
      }
    }
    setGameResolved(true); 
    setShowBoard(false); 
    setActiveGameId(null); 
    setGameData(null);
    setHasLoadedGame(false);
  };

  const handleGameEnd = async (status: InternalGameStatus, time: number, boardState: string) => {
    setGameResolved(true); 
    if (!user || !activeGameIdRef.current) { 
      // setShowBoard(false); // Don't hide board, user should see the final state
      // setActiveGameId(null); // Don't clear activeGameId yet, needed for saving
      // setGameData(null); // Don't clear game data yet
      // setHasLoadedGame(false); // Don't reset this until after saving/quitting etc.
      if (status === 'quit') { // Handle explicit quit from GameBoard if it sends 'quit'
          // This case might be redundant if quit is handled by PlayPage's handleQuitGame
      }
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
      startTime: gameDataRef.current?.startTime || Timestamp.now(), 
      difficulty: gameDataRef.current?.difficulty || DIFFICULTY_LEVELS[selectedDifficultyKey].name,
    };
    
    setGameData(prev => prev ? {...prev, ...finalGameData} : null);

    try {
      await updateDoc(gameDocRef, finalGameData);
    } catch (error) {
      console.error("Error saving game result:", error);
      toast({ title: "Save Result Failed", description: "Could not save game result.", variant: "destructive" });
    } finally {
      setIsSavingOrStarting(false);
      setHasLoadedGame(false); 
      // Consider if activeGameId and gameData should be cleared here or if user might want to start new game
      // For now, let them exist so they can click "Start Game" to clear and start fresh.
    }
  };

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (user && activeGameIdRef.current && !gameResolvedRef.current && firestore && gameBoardRef.current) {
        handleSaveGame(true); 
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (user && activeGameIdRef.current && !gameResolvedRef.current && firestore && gameBoardRef.current) {
         handleSaveGame(true);
      }
    };
  }, [user, firestore, handleSaveGame]); 

  const difficultyConfig = DIFFICULTY_LEVELS[selectedDifficultyKey] || DIFFICULTY_LEVELS['medium'];

  const boardInitialState = gameData?.result === 'in-progress' && gameData.gameState && !nonJsonGameStates.includes(gameData.gameState)
    ? gameData.gameState
    : undefined;
  
  const timeToRestore = gameData?.result === 'in-progress' && gameData.startTime && gameBoardRef.current
    ? gameBoardRef.current.calculateTimeFromStart(gameData.startTime)
    : 0;


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
                onValueChange={async (value) => {
                    if (user && activeGameIdRef.current && !gameResolvedRef.current && firestore) {
                       try {
                            const gameDocRef = doc(firestore, 'games', activeGameIdRef.current);
                            await updateDoc(gameDocRef, { 
                                result: 'quit', 
                                endTime: Timestamp.now(), 
                                gameState: gameBoardRef.current?.getCurrentBoardState() || "QUIT_ON_DIFFICULTY_CHANGE" 
                            });
                            setActiveGameId(null); 
                            setGameData(null); 
                       } catch (err) {
                            console.error("Error quitting game on difficulty change:", err);
                            toast({title: "Error", description: "Failed to quit previous game.", variant: "destructive"});
                       }
                    }
                    setSelectedDifficultyKey(value as DifficultyKey);
                    setShowBoard(false); 
                    setGameResolved(true); 
                    setGameData(null); 
                }}                disabled={isSavingOrStarting || (showBoard && !!(activeGameIdRef.current ?? false) && !(gameResolvedRef.current ?? true) && !!(user ?? false) && (gameData?.difficulty ?? null) === DIFFICULTY_LEVELS[selectedDifficultyKey].name)}
              >
                <SelectTrigger id="difficulty-select" className="w-full" title={(showBoard && !!(activeGameIdRef.current ?? false) && !(gameResolvedRef.current ?? true) && !!(user ?? false) && (gameData?.difficulty ?? null) === DIFFICULTY_LEVELS[selectedDifficultyKey].name) ? "Game in progress. To change difficulty, first Quit or Restart, then select new difficulty and Start Game." : "Select difficulty"}>
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
                disabled={isSavingOrStarting || (showBoard && !!(activeGameIdRef.current ?? false) && !(gameResolvedRef.current ?? true) && !!(user ?? false) && (gameData?.difficulty ?? null) === DIFFICULTY_LEVELS[selectedDifficultyKey].name)}
                title={
                    (showBoard && activeGameIdRef.current && !gameResolvedRef.current && user && gameData?.difficulty === DIFFICULTY_LEVELS[selectedDifficultyKey].name)
                    ? "Game already in progress with this difficulty. Choose 'Restart' or 'Quit'." 
                    : (showBoard && activeGameIdRef.current && !gameResolvedRef.current && user ? 'Start New Game (will quit current)' : (gameData?.result === 'in-progress' ? 'Resume Game' : 'Start Game'))
                }
            >
              {(showBoard && activeGameIdRef.current && !gameResolvedRef.current && user && gameData?.difficulty !== DIFFICULTY_LEVELS[selectedDifficultyKey].name) 
                ? 'Start New (different difficulty)' 
                : (gameData?.result === 'in-progress' && gameData?.difficulty === DIFFICULTY_LEVELS[selectedDifficultyKey].name ? 'Resume Game' : 'Start Game')}
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
                initialTimeElapsed={timeToRestore}
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
                <Save className="mr-2 h-4 w-4" /> {isSavingOrStarting && activeGameIdRef.current && gameData?.result === 'in-progress' ? "Saving..." : "Save Game"}
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleQuitGame} 
                className="w-full sm:w-auto" 
                disabled={isSavingOrStarting || (gameResolvedRef.current && gameData?.result !== 'in-progress')} 
                title={gameResolvedRef.current && gameData?.result !== 'in-progress' ? "Game already ended" : "Quit current game (progress will be saved)"}
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
                    {user && isSavingOrStarting && !hasLoadedGame && !showBoard ? "Loading your game..." : 
                     (user && gameData && gameData.result === 'in-progress' && !showBoard) ? `An in-progress game (${gameData.difficulty}) was found. Click "Resume Game" above or "Start Game" if the difficulty matches.` :
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

