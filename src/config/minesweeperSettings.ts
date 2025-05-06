
export interface DifficultySetting {
  rows: number;
  cols: number;
  mines: number;
  name: string;
}

export const DIFFICULTY_LEVELS: Record<string, DifficultySetting> = {
  easy: { rows: 9, cols: 9, mines: 10, name: 'Easy' },
  medium: { rows: 16, cols: 16, mines: 40, name: 'Medium' },
  hard: { rows: 16, cols: 30, mines: 99, name: 'Hard' },
};

export type DifficultyKey = keyof typeof DIFFICULTY_LEVELS;
