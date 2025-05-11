
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

export const createInitialBoard = (rows: number, cols: number, mines: number): BoardState => {
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
        isReplayHighlight: false, // Initialize highlight state
        isReplayHighlightBad: false, // Initialize bad highlight state
      });
    }
    board.push(row);
  }

  let minesPlaced = 0;
  while (minesPlaced < mines) {
    const y = Math.floor(Math.random() * rows);
    const x = Math.floor(Math.random() * cols);

    if (!board[y][x].isMine) {
      board[y][x].isMine = true;
      minesPlaced++;
    }
  }

  // After placing mines, calculate adjacent mine counts
  return calculateAdjacentMines(board, rows, cols);
};

/*
 Removed placeMines function as mines are now placed in createInitialBoard
export const placeMines = (board: BoardState, rows: number, cols: number, minesToPlace: number, firstClickX?: number, firstClickY?: number): BoardState => {
  const newBoard = board.map(row => row.map(cell => ({ ...cell })));
  let minesPlaced = 0;
  const safeZone = new Set<string>();

  // Define the first click and its adjacent cells as safe if firstClickX/Y are provided
  if (firstClickX !== undefined && firstClickY !== undefined) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const ny = firstClickY + dy;
        const nx = firstClickX + dx;
        if (ny >= 0 && ny < rows && nx >= 0 && nx < cols) {
          safeZone.add(`${nx}-${ny}`);
        }
      }
    }
  }


  // Safety check: if minesToPlace is too high for the available cells after excluding safe zone
  const availableCellsForMines = (rows * cols) - safeZone.size;
  if (minesToPlace > availableCellsForMines) {
      console.warn(`Too many mines (${minesToPlace}) for the available cells (${availableCellsForMines}) after considering safe zone. Adjusting mine count to ${availableCellsForMines}.`);
      minesToPlace = Math.max(0, availableCellsForMines);
  }


  while (minesPlaced < minesToPlace) {
    const y = Math.floor(Math.random() * rows);
    const x = Math.floor(Math.random() * cols);

    if (!newBoard[y][x].isMine && !safeZone.has(`${x}-${y}`)) {
      newBoard[y][x].isMine = true;
      minesPlaced++;
    }
  }
  return board;
};
*/


export const calculateAdjacentMines = (board: BoardState, rows: number, cols: number): BoardState => {
  const newBoard = board.map(row => row.map(cell => ({ ...cell, adjacentMines: 0 }))); // Reset adjacentMines
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (newBoard[y][x].isMine) {
        // newBoard[y][x].adjacentMines = -1; // Mines don't have an adjacent mine count relevant to display
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

export const revealCell = (
  board: BoardState,
  rows: number,
  cols: number,
  x: number,
  y: number
): { newBoard: BoardState; gameOver: boolean; cellsRevealedCount: number } => {
  let currentBoard = board.map(row => row.map(cell => ({ ...cell })));
  currentBoard.forEach((row: CellState[]) => row.forEach(cell => {
    cell.isReplayHighlight = false;
    cell.isReplayHighlightBad = false;
  }));

  let gameOver = false;
  let cellsRevealedCount = 0;

  const reveal = (rx: number, ry: number) => {
    if (ry < 0 || ry >= rows || rx < 0 || rx >= cols || currentBoard[ry][rx].isRevealed || currentBoard[ry][rx].isFlagged) {
      return;
    }

    currentBoard[ry][rx].isRevealed = true;
    
    if (currentBoard[ry][rx].isMine) {
      currentBoard[ry][rx].exploded = true; // Mark the clicked mine as exploded
      gameOver = true;
      return; // Stop recursion for this path
    }
    
    cellsRevealedCount++;

    if (currentBoard[ry][rx].adjacentMines === 0) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          reveal(rx + dx, ry + dy);
        }
      }
    }
  };

  reveal(x, y);

  if (gameOver) {
    // When the game is over (a mine was clicked), reveal all other mines.
    // The mine that was clicked is already marked as isRevealed = true and exploded = true.
    for (let r_idx = 0; r_idx < rows; r_idx++) {
      for (let c_idx = 0; c_idx < cols; c_idx++) {
        if (currentBoard[r_idx][c_idx].isMine) {
          currentBoard[r_idx][c_idx].isRevealed = true;
          // Note: only the clicked mine gets `exploded = true`. Other mines just get `isRevealed = true`.
        }
        // Optional: If a cell was flagged but it's NOT a mine, you might want to reveal it
        // to show the player their mistake.
        // else if (currentBoard[r_idx][c_idx].isFlagged && !currentBoard[r_idx][c_idx].isMine) {
        //   currentBoard[r_idx][c_idx].isRevealed = true; // This would show its number or be blank
        // }
      }
    }
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

