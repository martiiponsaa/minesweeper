
'use client';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import React, { useState, useEffect, useRef, useCallback } from 'react';
import GameBoard, { type GameBoardRef } from '@/components/minesweeper/GameBoard'; // Removed InternalGameStatus import
import type { GameStatus } from '@/lib/minesweeper'; // Import GameStatus from lib
import { DIFFICULTY_LEVELS, type DifficultyKey } from '@/config/minesweeperSettings';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, useSearchParams } from 'next/navigation';
import { Save, LogOutIcon, RotateCcw, Lightbulb } from 'lucide-react';
import { useToast } from '@/components/ui/toaster';
import { getFirebase } from '@/firebase';
import { doc, setDoc, Timestamp, collection, updateDoc, query, where, getDocs, writeBatch, limit, orderBy, deleteDoc, getDoc } from 'firebase/firestore';
import { arrayUnion, type FieldValue } from 'firebase/firestore';
import type { Game, GameResult } from '@/lib/firebaseTypes';


const nonJsonGameStates = [
  "INITIAL_BOARD_STATE",
  "QUIT_FOR_NEW_GAME",
  "QUIT_ON_RESTART",
  "QUIT_ON_DIFFICULTY_CHANGE",
  "QUIT_STATE_UNKNOWN",
  "AUTO_QUIT_MULTIPLE_IN_PROGRESS",
];

const INITIAL_HINT_COUNT = 3;

export default function PlayPage() {
  const [selectedDifficultyKey, setSelectedDifficultyKey] = useState<DifficultyKey>('medium');
  const [gameKey, setGameKey] = useState<number>(0);
  const [showBoard, setShowBoard] = useState<boolean>(false);
  const { user } = useAuth();
  const { firestore } = getFirebase();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isSavingOrStarting, setIsSavingOrStarting] = useState(false);
  const gameBoardRef = useRef<GameBoardRef>(null);

  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const [gameData, setGameData] = useState<Game | null>(null);
  const [gameResolved, setGameResolved] = useState(false);
  const [gameStatusFromBoard, setGameStatusFromBoard] = useState<GameStatus | null>(null); // Changed type
  const [hintsRemaining, setHintsRemaining] = useState<number>(INITIAL_HINT_COUNT);

  const [initialGameLoadAttempted, setInitialGameLoadAttempted] = useState(false);

  const activeGameIdRef = useRef(activeGameId);
  const gameDataRef = useRef(gameData);
  const gameResolvedRef = useRef(gameResolved);

  useEffect(() => { activeGameIdRef.current = activeGameId; }, [activeGameId]);
  useEffect(() => { gameDataRef.current = gameData; }, [gameData]);
  useEffect(() => { gameResolvedRef.current = gameResolved; }, [gameResolved]);

  const handleInternalGameStatusChange = useCallback((status: GameStatus) => {
    setGameStatusFromBoard(status);
  }, []);

  useEffect(() => {
    if (!user || !firestore || initialGameLoadAttempted) {
      if (!user && !initialGameLoadAttempted) {
          setInitialGameLoadAttempted(false); // Should be true if guest, so they don't try to load
          setActiveGameId(null);
          setGameData(null);
          setShowBoard(false);
          setGameResolved(true);
          setGameStatusFromBoard(null);
      }
      return;
    }

    const loadGame = async () => {
      setIsSavingOrStarting(true);
      setInitialGameLoadAttempted(true);
      const gameIdFromUrl = searchParams.get('gameId');

      let gameToLoad: Game | null = null;
      let gameToLoadId: string | null = null;

      if (gameIdFromUrl) {
        try {
          const gameDocRef = doc(firestore, 'games', gameIdFromUrl);
          const gameDocSnap = await getDoc(gameDocRef);
          if (gameDocSnap.exists()) {
            const data = gameDocSnap.data() as Omit<Game, 'id'>;
            if (data.userId === user.uid && (data.result === 'continue' || data.result === 'in-progress')) {
              gameToLoad = { id: gameDocSnap.id, ...data };
              gameToLoadId = gameDocSnap.id;
              toast({title: "Continuing Game", description: `Loaded game ${gameIdFromUrl.substring(0,6)} from URL.`});
            } else if (data.userId !== user.uid) {
                toast({title: "Access Denied", description: "This game belongs to another user.", variant: "destructive"});
            } else if (data.result !== 'continue' && data.result !== 'in-progress') {
                 toast({title: "Game Not Continuable", description: `Game ${gameIdFromUrl.substring(0,6)} has ended: ${data.result}. Starting new.`, variant: "default"});
            } else {
                 toast({title: "Game Not Found", description: `Game ${gameIdFromUrl.substring(0,6)} not found or invalid.`, variant: "destructive"});
            }
          } else {
            toast({title: "Game Not Found", description: `Game with ID ${gameIdFromUrl.substring(0,6)} not found.`, variant: "destructive"});
          }
        } catch (error) {
          console.error("Error loading game by ID from URL:", error);
          toast({ title: "Error Loading Game", description: "Could not load the game specified in the URL.", variant: "destructive" });
        }
        router.replace('/play', { scroll: false });
      }

      if (!gameToLoad) {
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
            gameToLoad = { id: gameDoc.id, ...gameDoc.data() } as Game;
            gameToLoadId = gameDoc.id;
            toast({title: "Resuming Game", description: "Loaded your last saved game."});
          }
        } catch (error) {
          console.error("Error loading latest 'continue' game:", error);
        }
      }

      if (gameToLoad && gameToLoadId) {
        if (activeGameIdRef.current && activeGameIdRef.current !== gameToLoadId && !gameResolvedRef.current) {
          try {
            const oldGameDocRef = doc(firestore, 'games', activeGameIdRef.current);
            await updateDoc(oldGameDocRef, { result: 'quit', endTime: Timestamp.now(), gameState: gameBoardRef.current?.getCurrentBoardState() || "AUTO_QUIT_MULTIPLE_IN_PROGRESS" });
          } catch (error) {
            console.error("Error quitting previous active game:", error);
          }
        }

        try {
          const gameDocRef = doc(firestore, 'games', gameToLoadId);
          await updateDoc(gameDocRef, { result: 'in-progress' });
          gameToLoad.result = 'in-progress';

          setGameData(gameToLoad);
          setActiveGameId(gameToLoadId);
          const difficultyKeyFromName = Object.keys(DIFFICULTY_LEVELS).find(
            key => DIFFICULTY_LEVELS[key as DifficultyKey].name === gameToLoad!.difficulty
          ) as DifficultyKey | undefined;
          setSelectedDifficultyKey(difficultyKeyFromName || 'medium');
          setShowBoard(true);
          setGameResolved(false);
          setHintsRemaining(INITIAL_HINT_COUNT);
          // setGameStatusFromBoard will be set by GameBoard via onInternalGameStatusChange
          setGameKey(prevKey => prevKey + 1);
        } catch (error) {
          console.error("Error setting loaded game to 'in-progress':", error);
          toast({ title: "Error Resuming", description: "Could not update game status to active.", variant: "destructive" });
          // Do not set initialGameLoadAttempted to false here, as an attempt was made.
        }
      } else {
        // No game loaded (neither from URL nor from 'continue' state)
        // If a game was manually started and is active, don't hide it.
        // If no game is active, ensure the board isn't shown.
        if (!activeGameIdRef.current) {
          // setShowBoard(false); // This line was removed to prevent hiding an already active manual game
        }
      }
      setIsSavingOrStarting(false);
    };

    loadGame();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, firestore, searchParams, initialGameLoadAttempted]); // Removed router from deps as it was causing re-runs

  useEffect(() => {
    return () => {
      if (user && firestore && activeGameIdRef.current && gameDataRef.current?.result === 'in-progress' && !gameResolvedRef.current) {
        const boardState = gameBoardRef.current?.getCurrentBoardState();
        if (boardState && !nonJsonGameStates.includes(boardState)) {
          const gameDocRef = doc(firestore, 'games', activeGameIdRef.current);
          updateDoc(gameDocRef, {
            result: 'continue',
            gameState: boardState,
            lastSavedTime: Timestamp.now(),
          }).catch(error => {
            console.error("Error saving game as 'continue' on unmount:", error);
          });
        }
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, firestore]);


  const handleStartGame = async () => {
    setIsSavingOrStarting(true);
    setGameResolved(false);
    // setGameStatusFromBoard('ready'); // This will be set by GameBoard via callback
    setHintsRemaining(INITIAL_HINT_COUNT);

    if (user && activeGameIdRef.current && firestore && !gameResolvedRef.current) {
        try {
            const oldGameDocRef = doc(firestore, 'games', activeGameIdRef.current);
            const currentBoardStateForQuit = gameBoardRef.current?.getCurrentBoardState() || "QUIT_FOR_NEW_GAME";
            await updateDoc(oldGameDocRef, {
                result: 'quit',
                endTime: Timestamp.now(),
                gameState: currentBoardStateForQuit
            });
        } catch (error) {
            console.error("Error quitting previous game on new start:", error);
        }
    }

    setGameData(null);
    setActiveGameId(null);
    setShowBoard(true);
    setGameKey(prevKey => prevKey + 1);

    if (!user) {
        setIsSavingOrStarting(false);
        setInitialGameLoadAttempted(true); // Mark as attempted for guest
        return;
    }
    if (!firestore) {
      toast({ title: "Error", description: "Firestore is not available.", variant: "destructive" });
      setIsSavingOrStarting(false);
      return;
    }

    const newGameDocRef = doc(collection(firestore, 'games'));
    const newGameEntry: Omit<Game, 'id'> = {
      userId: user.uid,
      startTime: Timestamp.now(),
      endTime: null,
      gameState: "INITIAL_BOARD_STATE",
      difficulty: DIFFICULTY_LEVELS[selectedDifficultyKey].name,
      moves: [],
      result: 'in-progress',
    };

    try {
      await setDoc(newGameDocRef, newGameEntry);
      setGameData({id: newGameDocRef.id, ...newGameEntry});
      setActiveGameId(newGameDocRef.id);
      setInitialGameLoadAttempted(true); // Mark as attempt successful
      toast({ title: "New Game Started", description: `Difficulty: ${DIFFICULTY_LEVELS[selectedDifficultyKey].name}`});
    } catch (error) {
      console.error("Error creating new game:", error);
      toast({ title: "Error Starting Game", description: "Could not create a new game record.", variant: "destructive" });
      setShowBoard(false);
      setActiveGameId(null);
      setGameData(null);
      setInitialGameLoadAttempted(true); // Mark as attempt failed but done
    } finally {
      setIsSavingOrStarting(false);
    }
  };

  const handleMoveMade = useCallback(async (moveType: 'reveal' | 'flag' | 'unflag', x: number, y: number) => {
    if (!user || !activeGameIdRef.current || !firestore) {
      return;
    }
    const gameDocRef = doc(firestore, 'games', activeGameIdRef.current);
    const move = { action: moveType, x, y, timestamp: Timestamp.now() };
    try {
      if (x >= 0 && y >= 0) {
        await updateDoc(gameDocRef, { moves: arrayUnion(move) });
      }
      if (gameBoardRef.current) {
        const currentBoardState = gameBoardRef.current.getCurrentBoardState();
        await updateDoc(gameDocRef, { gameState: currentBoardState, lastSavedTime: Timestamp.now() });
      }
    } catch (error) {
      console.error("Error logging move to Firestore:", error);
       if (error instanceof Error && (error as any).code === 'not-found') { // More specific check
          toast({ title: "Sync Error", description: "Game document not found in DB for this move. Please try restarting the game.", variant: "destructive" });
          // Consider resetting local game state here or guiding user
          setShowBoard(false);
          setActiveGameId(null);
          setGameData(null);
          setGameResolved(true);
          setInitialGameLoadAttempted(false); // Allow re-attempt to load/start
        }
    }
  }, [user, firestore]);

  const handleRestartGame = async () => {
    if (user && activeGameIdRef.current && firestore && !gameResolvedRef.current) {
        try {
            const gameDocRef = doc(firestore, 'games', activeGameIdRef.current);
            const currentBoardStateForQuit = gameBoardRef.current?.getCurrentBoardState() || "QUIT_ON_RESTART";
            await updateDoc(gameDocRef, { result: 'quit', endTime: Timestamp.now(), gameState: currentBoardStateForQuit });
            toast({ title: "Game Restarted", description: "The previous game was marked as quit." });
        } catch (error) {
            console.error("Error quitting previous game on restart:", error);
            toast({ title: "Error", description: "Could not update previous game status.", variant: "destructive" });
        }
    }
    setGameResolved(false);
    setGameData(null);
    setActiveGameId(null);
    // setGameStatusFromBoard('ready'); // Will be set by GameBoard
    setHintsRemaining(INITIAL_HINT_COUNT);
    await handleStartGame(); // This will call setGameKey internally
  };


  const handleSaveGame = useCallback(async (isAutoSave = false) => {
    if (!user || !activeGameIdRef.current) {
      if (!isAutoSave) {
        toast({ title: !user ? "Login Required" : "No Active Game", description: !user ? "You need to be logged in." : "No active game to save.", variant: "destructive" });
      }
      return;
    }
    if (!firestore || !gameBoardRef.current) {
        if (!isAutoSave) toast({ title: "Error", description: "Cannot save game.", variant: "destructive" });
        return;
    }
    if (gameResolvedRef.current && gameDataRef.current?.result !== 'in-progress') {
        if (!isAutoSave) toast({ title: "Game Ended", description: `Cannot save ended game: ${gameDataRef.current?.result}.`, variant: "default" });
        return;
    }
    setIsSavingOrStarting(true);
    const currentBoardState = gameBoardRef.current.getCurrentBoardState();
    if (!currentBoardState || currentBoardState === "undefined" || nonJsonGameStates.includes(currentBoardState) ) {
        if (!isAutoSave) toast({ title: "Save Error", description: "Invalid board state.", variant: "destructive"});
        setIsSavingOrStarting(false);
        return;
    }
    const gameDocRef = doc(firestore, 'games', activeGameIdRef.current);
    const gameDataToUpdate: Partial<Game> = {
      gameState: currentBoardState,
      result: 'in-progress',
      startTime: gameDataRef.current?.startTime || Timestamp.now(),
      difficulty: gameDataRef.current?.difficulty || DIFFICULTY_LEVELS[selectedDifficultyKey].name,
      endTime: null,
      lastSavedTime: Timestamp.now(),
    };
    setGameData(prev => prev ? {...prev, ...gameDataToUpdate } as Game : null);
    try {
      await updateDoc(gameDocRef, gameDataToUpdate);
      if (!isAutoSave) {
        toast({ title: "Game Saved!", description: "Progress saved." });
      }
    } catch (error) {
      console.error("Error saving game:", error);
      if (!isAutoSave) toast({ title: "Save Failed", description: "Could not save.", variant: "destructive" });
    } finally {
      setIsSavingOrStarting(false);
    }
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
        toast({ title: "Game Surrendered", description: "Game marked as quit." });
      } catch (error) {
        console.error("Error quitting game:", error);
        toast({ title: "Error Quitting", description: "Could not update status.", variant: "destructive" });
      } finally {
        setIsSavingOrStarting(false);
      }
    }
    setGameResolved(true);
    setShowBoard(false);
    setActiveGameId(null);
    setGameData(null);
    setInitialGameLoadAttempted(false);
    setGameStatusFromBoard('quit');
  };

  const handleGameEnd = async (status: 'won' | 'lost' | 'quit', time: number, boardState: string) => { // Updated type
    setGameStatusFromBoard(status);
    setGameResolved(true);
    if (!user || !activeGameIdRef.current) {
      return;
    }
    if (!firestore) {
      toast({ title: "Error", description: "Firestore not available.", variant: "destructive" });
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
      toast({ title: "Save Result Failed", description: "Could not save result.", variant: "destructive" });
    } finally {
      setIsSavingOrStarting(false);
    }
  };

  const handleRequestHint = () => {
    const isGameActiveForHint = showBoard && !gameResolvedRef.current && (gameStatusFromBoard === 'playing' || gameStatusFromBoard === 'ready');
    if (!isGameActiveForHint) {
      toast({ title: "Hint Unavailable", description: "Hints can only be used during active gameplay or on a ready board.", variant: "default" });
      return;
    }

    if (hintsRemaining > 0) {
      const hintGiven = gameBoardRef.current?.requestHint();
      if (hintGiven) {
        setHintsRemaining(prev => prev - 1);
        toast({ title: "Hint Used!", description: `You have ${hintsRemaining - 1} hints left.` });
        // Board state saving is handled by onMoveMade, triggered by requestHint's internal call to handleCellClick
      } else {
        toast({ title: "No Hint Available", description: "Could not find a suitable cell to reveal.", variant: "default" });
      }
    } else {
      toast({ title: "No More Hints", description: "You've used all your hints for this game.", variant: "destructive" });
    }
  };

  const handleBeforeUnload = useCallback((event: BeforeUnloadEvent) => {
      if (user && activeGameIdRef.current && !gameResolvedRef.current && firestore && gameBoardRef.current) {
        event.preventDefault();
        event.returnValue = 'You have an unsaved game. Are you sure you want to leave?';
      }
    }, [user, firestore]);

  useEffect(() => {
    const autoSaveInterval = setInterval(() => {
      if (user && activeGameIdRef.current && !gameResolvedRef.current && firestore && gameBoardRef.current && gameStatusFromBoard === 'playing') {
        handleSaveGame(true);
      }
    }, 30000);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      clearInterval(autoSaveInterval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [user, firestore, handleSaveGame, handleBeforeUnload, gameStatusFromBoard]);


  const difficultyConfig = DIFFICULTY_LEVELS[selectedDifficultyKey] || DIFFICULTY_LEVELS['medium'];

  const boardInitialState = (gameData?.gameState && !nonJsonGameStates.includes(gameData.gameState))
    ? gameData.gameState
    : undefined;

  const timeToRestore = (gameData?.result === 'in-progress' || gameData?.result === 'continue') && gameData.startTime
    ? 0
    : (gameData?.endTime && gameData?.startTime ? Math.round((gameData.endTime.toDate().getTime() - gameData.startTime.toDate().getTime())/1000) : 0);


  return (
    <AppLayout>
      <div className="container mx-auto p-4 md:p-8 flex flex-col items-center">
        <h1 className="text-3xl font-bold text-foreground mb-8">Play MineVerse</h1>
        <Card className="w-full max-w-3xl mb-8">
          <CardHeader>
            <CardTitle>Game Setup</CardTitle>
            <CardDescription>Choose difficulty to start or resume a game.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row items-center sm:items-baseline gap-4">
              <Label htmlFor="difficulty-select">Difficulty</Label>
              <Select
                value={selectedDifficultyKey}
                onValueChange={async (value) => {
                    if (user && activeGameIdRef.current && !gameResolvedRef.current && firestore && gameStatusFromBoard === 'playing') { // Only quit if actively playing
                       try {
                            const gameDocRef = doc(firestore, 'games', activeGameIdRef.current);
                            await updateDoc(gameDocRef, {
                                result: 'quit',
                                endTime: Timestamp.now(),
                                gameState: gameBoardRef.current?.getCurrentBoardState() || "QUIT_ON_DIFFICULTY_CHANGE"
                            });
                       } catch (err) {
                            console.error("Error quitting game on difficulty change:", err);
                       }
                    }
                    setActiveGameId(null);
                    setGameData(null);
                    setShowBoard(false);
                    setGameResolved(true);
                    setGameStatusFromBoard(null);
                    setSelectedDifficultyKey(value as DifficultyKey);
                    setHintsRemaining(INITIAL_HINT_COUNT);
                    // Do not call handleStartGame here, user must click "Start Game"
                }}
                disabled={isSavingOrStarting}
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
 disabled={Boolean(isSavingOrStarting || (showBoard && activeGameIdRef.current && !gameResolvedRef.current && user && gameData?.difficulty === DIFFICULTY_LEVELS[selectedDifficultyKey].name && gameStatusFromBoard === 'playing'))}
                 title={
                    (showBoard && activeGameIdRef.current && !gameResolvedRef.current && user && gameData?.difficulty === DIFFICULTY_LEVELS[selectedDifficultyKey].name && gameStatusFromBoard === 'playing')
                    ? "A game is in progress. Click Restart or Surrender first."
                    : "Start a new game with the selected difficulty"
                }
            >
              {(showBoard && activeGameIdRef.current && !gameResolvedRef.current && user && gameData?.difficulty === DIFFICULTY_LEVELS[selectedDifficultyKey].name && gameStatusFromBoard === 'playing')
                ? 'New Game'
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
                initialTimeElapsed={timeToRestore}
                onMoveMade={handleMoveMade}
                activeGameId={activeGameId}
                reviewMode={false}
                onInternalGameStatusChange={handleInternalGameStatusChange}
              />
            </CardContent>

            <CardFooter className="flex flex-col sm:flex-row justify-around gap-2 pt-4">
              <Button variant="outline" onClick={handleRestartGame} className="w-full sm:w-auto" disabled={isSavingOrStarting}>
                <RotateCcw className="mr-2 h-4 w-4" /> Restart
              </Button>
              <Button
                variant="outline"
                onClick={handleRequestHint}
                className="w-full sm:w-auto"
                disabled={isSavingOrStarting || gameResolvedRef.current || hintsRemaining <= 0 || (gameStatusFromBoard !== 'playing' && gameStatusFromBoard !== 'ready')}
                title={hintsRemaining <=0 ? "No hints left" : ((gameStatusFromBoard !== 'playing' && gameStatusFromBoard !== 'ready') ? "Hint unavailable until game starts/plays" : `Use Hint (${hintsRemaining} left)`)}
              >
                <Lightbulb className="mr-2 h-4 w-4" /> Hint ({hintsRemaining})
              </Button>
              <Button
                variant="destructive"
                onClick={handleQuitGame}
                className="w-full sm:w-auto"
                disabled={isSavingOrStarting || (gameResolvedRef.current && (gameData?.result !== 'in-progress' && gameData?.result !== 'continue'))}
                title={gameResolvedRef.current && (gameData?.result !== 'in-progress' && gameData?.result !== 'continue') ? "Game already ended" : "Surrendering will mark this game as quit."}
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
                {user && isSavingOrStarting && !initialGameLoadAttempted && !showBoard
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

