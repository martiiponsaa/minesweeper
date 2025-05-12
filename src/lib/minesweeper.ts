
import type { DifficultySetting } from '@/config/minesweeperSettings';

export interface CellState {
  isRevealed: boolean;
  isMine: boolean;
  isFlagged: boolean;
  adjacentMines: number;
  x: number;
  y: number;
  exploded?: boolean; // For showing the mine that was clicked
  isReplayHighlight?: boolean; // For highlighting the current actioned cell in replay
  isReplayHighlightBad?: boolean; // For indicating if the replayed move was bad (red highlight)
}

export type BoardState = CellState[][];

export type GameStatus = 'ready' | 'playing' | 'won' | 'lost';

// Creates an empty board structure without mines. Mines are placed on the first click.
export const createInitialBoard = (rows: number, cols: number): BoardState => {
  const board: BoardState = [];
  for (let y = 0; y < rows; y++) {
    const row: CellState[] = [];
    for (let x = 0; x < cols; x++) {
      row.push({
        isRevealed: false,
        isMine: false,
        isFlagged: false,
        adjacentMines: 0,
        x,
        y,
        isReplayHighlight: false,
        isReplayHighlightBad: false,
      });
    }
    board.push(row);
  }
  return board;
};

export const placeMinesAndRevealFirstArea = (
  initialBoard: BoardState,
  rows: number,
  cols: number,
  minesToPlace: number,
  firstClickX: number,
  firstClickY: number
): { newBoard: BoardState; cellsRevealedThisTurn: number } => {
  const boardWithMines = initialBoard.map(row => row.map(cell => ({ ...cell })));

  // Define a 3x3 safe zone around the first click
  const safeZone = new Set<string>();
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const ny = firstClickY + dy;
      const nx = firstClickX + dx;
      if (ny >= 0 && ny < rows && nx >= 0 && nx < cols) {
        safeZone.add(`${nx}-${ny}`);
      }
    }
  }

  // Place mines outside the safe zone
  let minesPlaced = 0;
  const maxAttempts = rows * cols * 5; // Prevent infinite loop in unlikely scenarios
  let attempts = 0;

  // Adjust minesToPlace if safe zone is too large relative to mine count
  const availableCellsForMines = (rows * cols) - safeZone.size;
  if (minesToPlace > availableCellsForMines) {
    console.warn(`Adjusting mines to place from ${minesToPlace} to ${availableCellsForMines} due to safe zone size.`);
    minesToPlace = Math.max(0, availableCellsForMines);
  }


  while (minesPlaced < minesToPlace && attempts < maxAttempts) {
    const y = Math.floor(Math.random() * rows);
    const x = Math.floor(Math.random() * cols);

    if (!boardWithMines[y][x].isMine && !safeZone.has(`${x}-${y}`)) {
      boardWithMines[y][x].isMine = true;
      minesPlaced++;
    }
    attempts++;
  }
   if (minesPlaced < minesToPlace) {
    console.warn(`Could not place all ${minesToPlace} mines. Placed ${minesPlaced}. This might happen if the board is very small or dense.`);
  }


  // Calculate adjacent mines for the entire board
  const boardWithCounts = calculateAdjacentMines(boardWithMines, rows, cols);

  // Reveal the area starting from the first click
  let cellsRevealedThisTurn = 0;
  const finalBoard = boardWithCounts.map(row => row.map(cell => ({ ...cell })));

  const revealRecursive = (rx: number, ry: number) => {
    if (ry < 0 || ry >= rows || rx < 0 || rx >= cols || finalBoard[ry][rx].isRevealed || finalBoard[ry][rx].isFlagged) {
      return;
    }

    finalBoard[ry][rx].isRevealed = true;
    cellsRevealedThisTurn++;

    // Since this is the first click and it's in a safe zone, it cannot be a mine.
    // If the cell is empty (0 adjacent mines), reveal its neighbors.
    if (finalBoard[ry][rx].adjacentMines === 0) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          revealRecursive(rx + dx, ry + dy);
        }
      }
    }
  };

  revealRecursive(firstClickX, firstClickY);

  return { newBoard: finalBoard, cellsRevealedThisTurn };
};


export const calculateAdjacentMines = (board: BoardState, rows: number, cols: number): BoardState => {
  const newBoard = board.map(row => row.map(cell => ({ ...cell, adjacentMines: 0 }))); // Reset adjacentMines
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (newBoard[y][x].isMine) {
        continue;
      }
      let mineCount = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const ny = y + dy;
          const nx = x + dx;
          if (ny >= 0 && ny < rows && nx >= 0 && nx < cols && newBoard[ny][nx].isMine) {
            mineCount++;
          }
        }
      }
      newBoard[y][x].adjacentMines = mineCount;
    }
  }
  return newBoard;
};

// This function now assumes mines are already placed.
export const revealCell = (
  board: BoardState,
  rows: number,
  cols: number,
  x: number,
  y: number
): { newBoard: BoardState; gameOver: boolean; cellsRevealedCount: number } => {
  let currentBoard = board.map(row => row.map(cell => ({ ...cell })));
  currentBoard.forEach((row: CellState[]) => row.forEach(cell => { // Reset replay highlights
    cell.isReplayHighlight = false;
    cell.isReplayHighlightBad = false;
  }));

  let gameOver = false;
  let cellsRevealedCount = 0;

  const revealRecursiveInternal = (rx: number, ry: number) => {
    if (ry < 0 || ry >= rows || rx < 0 || rx >= cols || currentBoard[ry][rx].isRevealed || currentBoard[ry][rx].isFlagged) {
      return;
    }

    currentBoard[ry][rx].isRevealed = true;
    
    if (currentBoard[ry][rx].isMine) { // Check if the currently revealed cell is a mine
      currentBoard[ry][rx].exploded = true; // Mark this specific mine as exploded
      gameOver = true; // Set game over flag
      return; // Stop revealing further if a mine is hit
    }
    
    cellsRevealedCount++; // Increment only for non-mine cells

    if (currentBoard[ry][rx].adjacentMines === 0) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          revealRecursiveInternal(rx + dx, ry + dy);
        }
      }
    }
  };

  revealRecursiveInternal(x, y); // Initial call to start the reveal process

  // After the reveal attempt, check if the game is over
  if (gameOver) {
    // If a mine was clicked (gameOver is true), iterate through the entire board
    // to reveal all mines.
    currentBoard = currentBoard.map(row => row.map(cell => {
      if (cell.isMine) {
        // Reveal all mines. The one that was clicked already has `exploded: true`.
        // Other mines will be revealed without `exploded: true`.
        return { ...cell, isRevealed: true };
      }
      return cell;
    }));
  }

  return { newBoard: currentBoard, gameOver, cellsRevealedCount };
};


export const toggleFlag = (board: BoardState, x: number, y: number): BoardState => {
  const newBoard = board.map(row => row.map(cell => ({ ...cell, isReplayHighlight: false, isReplayHighlightBad: false })));
  if (!newBoard[y][x].isRevealed) {
    newBoard[y][x].isFlagged = !newBoard[y][x].isFlagged;
  }
  return newBoard;
};

export const checkWinCondition = (board: BoardState, rows: number, cols: number, totalMines: number): boolean => {
  let revealedNonMineCells = 0;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (board[y][x].isRevealed && !board[y][x].isMine) {
        revealedNonMineCells++;
      }
    }
  }
  const totalNonMineCells = rows * cols - totalMines;
  // Ensure totalNonMineCells is not negative, which could happen if totalMines is miscalculated or too high
  if (totalNonMineCells < 0) return false; 
  return revealedNonMineCells === totalNonMineCells;
};

export const getRemainingMines = (board: BoardState, totalMines: number): number => {
  let flagsPlaced = 0;
  board.forEach(row => row.forEach(cell => {
    if (cell.isFlagged) {
      flagsPlaced++;
    }
  }));
  return totalMines - flagsPlaced;
};

