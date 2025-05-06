
import type { DifficultySetting } from '@/config/minesweeperSettings';

export interface CellState {
  isRevealed: boolean;
  isMine: boolean;
  isFlagged: boolean;
  adjacentMines: number;
  x: number;
  y: number;
  exploded?: boolean; // For showing the mine that was clicked
}

export type BoardState = CellState[][];

export type GameStatus = 'ready' | 'playing' | 'won' | 'lost';

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
      });
    }
    board.push(row);
  }
  return board;
};

export const placeMines = (
  board: BoardState,
  rows: number,
  cols: number,
  mines: number,
  firstClickX: number,
  firstClickY: number
): BoardState => {
  let minesPlaced = 0;
  const newBoard = board.map(row => row.map(cell => ({ ...cell })));

  while (minesPlaced < mines) {
    const y = Math.floor(Math.random() * rows);
    const x = Math.floor(Math.random() * cols);

    // Don't place a mine on the first clicked cell or if already a mine
    if ((x === firstClickX && y === firstClickY) || newBoard[y][x].isMine) {
      continue;
    }

    newBoard[y][x].isMine = true;
    minesPlaced++;
  }
  return calculateAdjacentMines(newBoard, rows, cols);
};

export const calculateAdjacentMines = (board: BoardState, rows: number, cols: number): BoardState => {
  const newBoard = board.map(row => row.map(cell => ({ ...cell })));
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (newBoard[y][x].isMine) {
        newBoard[y][x].adjacentMines = -1; // Indicates a mine
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
  const newBoard = board.map(row => row.map(cell => ({ ...cell })));
  let gameOver = false;
  let cellsRevealedCount = 0;

  const reveal = (rx: number, ry: number) => {
    if (ry < 0 || ry >= rows || rx < 0 || rx >= cols || newBoard[ry][rx].isRevealed || newBoard[ry][rx].isFlagged) {
      return;
    }

    newBoard[ry][rx].isRevealed = true;
    cellsRevealedCount++;

    if (newBoard[ry][rx].isMine) {
      newBoard[ry][rx].exploded = true;
      gameOver = true;
      return;
    }

    if (newBoard[ry][rx].adjacentMines === 0) {
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
    // Reveal all mines if game is over
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (newBoard[r][c].isMine) {
          newBoard[r][c].isRevealed = true;
        }
      }
    }
  }

  return { newBoard, gameOver, cellsRevealedCount };
};


export const toggleFlag = (board: BoardState, x: number, y: number): BoardState => {
  const newBoard = board.map(row => row.map(cell => ({ ...cell })));
  if (!newBoard[y][x].isRevealed) {
    newBoard[y][x].isFlagged = !newBoard[y][x].isFlagged;
  }
  return newBoard;
};

export const checkWinCondition = (board: BoardState, rows: number, cols: number, totalMines: number): boolean => {
  let revealedNonMineCells = 0;
  let flaggedMines = 0;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (board[y][x].isRevealed && !board[y][x].isMine) {
        revealedNonMineCells++;
      }
      if (board[y][x].isFlagged && board[y][x].isMine) {
        flaggedMines++;
      }
    }
  }
  const totalNonMineCells = rows * cols - totalMines;
  return revealedNonMineCells === totalNonMineCells || flaggedMines === totalMines;
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
