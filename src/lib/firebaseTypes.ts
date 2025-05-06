import { z } from 'zod';
import type { Timestamp } from 'firebase/firestore';

// Firestore Timestamp type for Zod
const timestampSchema = z.custom<Timestamp>((data) => data instanceof Object && 'toDate' in data && typeof data.toDate === 'function', {
  message: 'Expected Firestore Timestamp',
});

// User Entity
export const UserSchema = z.object({
  id: z.string(),
  username: z.string().optional(), 
  email: z.string().email().nullable().optional(), 
  profilePreferences: z.object({
    displayName: z.string().optional(),
    avatar: z.string().optional(), 
  }).optional(),
  friendCodes: z.array(z.string()).optional(),
  friendIds: z.array(z.string()).optional(), 
});

export type User = z.infer<typeof UserSchema>;


// Game Move Entity (Sub-object within Game)
export const MoveSchema = z.object({
  timestamp: timestampSchema,
  action: z.string(), 
  x: z.number().int(),
  y: z.number().int(),
});

export type Move = z.infer<typeof MoveSchema>;

// Game Result Schema and Type
export const GameResultSchema = z.enum(['won', 'lost', 'in-progress', 'quit']);
export type GameResult = z.infer<typeof GameResultSchema>;

// Game Entity
export const GameSchema = z.object({
  id: z.string(),
  userId: z.string(),
  startTime: timestampSchema,
  endTime: timestampSchema.nullable(),
  gameState: z.string(), 
  difficulty: z.string(), 
  moves: z.array(MoveSchema).optional(),
  result: GameResultSchema.nullable(), 
  lastSavedTime: timestampSchema.optional().nullable(), // Added for tracking last save
});

export type Game = z.infer<typeof GameSchema>;


// Friend Request Entity
export const FriendRequestStatusSchema = z.enum(['pending', 'accepted', 'rejected']);
export type FriendRequestStatus = z.infer<typeof FriendRequestStatusSchema>;

export const FriendRequestSchema = z.object({
  id: z.string(),
  requesterId: z.string(),
  recipientId: z.string(),
  status: FriendRequestStatusSchema,
});

export type FriendRequest = z.infer<typeof FriendRequestSchema>;

// Zod schema for updating user profile preferences
export const ProfilePreferencesSchema = z.object({
  displayName: z.string().min(1, "Display name cannot be empty").optional(),
  avatar: z.string().url("Invalid avatar URL").optional().or(z.literal("")), 
});
export type ProfilePreferences = z.infer<typeof ProfilePreferencesSchema>;
