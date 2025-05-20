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
    avatar: z.string().optional().or(z.literal("")), // Allows empty string for avatar
    allowStatsVisibility: z.boolean().optional(), // New field for stats visibility
    allowHistoryVisibility: z.boolean().optional(), // New field for history visibility
  }).nullable().optional(), // Made nullable and optional
  userFriendCode: z.string().length(10, "Friend code must be 10 characters").optional(),
  // friendCodes array is deprecated, friendships are stored in 'friendships' collection
  // friendIds array is deprecated, friendships are stored in 'friendships' collection
  createdAt: timestampSchema.nullable().optional(), 
});

export type User = z.infer<typeof UserSchema>;


// Game Move Entity (Sub-object within Game)
export const MoveSchema = z.object({
  timestamp: timestampSchema,
  action: z.string(), // Ensure action is always a string
  x: z.number().int(),
  y: z.number().int(),
});

export type Move = z.infer<typeof MoveSchema>;

// Game Result Schema and Type
export const GameResultSchema = z.enum(['won', 'lost', 'in-progress', 'quit', 'continue']);
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
  lastSavedTime: timestampSchema.optional().nullable(),
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
  requesterFriendCode: z.string().optional(),
  recipientFriendCode: z.string().optional(),
  createdAt: timestampSchema.nullable().optional(), 
});

export type FriendRequest = z.infer<typeof FriendRequestSchema>;

// Friendship Entity
export const FriendshipSchema = z.object({
  id: z.string(),
  users: z.array(z.string()).length(2, "Friendship must involve two users"),
  createdAt: timestampSchema.nullable().optional(), 
});
export type Friendship = z.infer<typeof FriendshipSchema>;


// Zod schema for updating user profile preferences
export const ProfilePreferencesSchema = z.object({
  displayName: z.string().min(1, "Display name cannot be empty").optional(),
  avatar: z.string().url("Invalid avatar URL").optional().or(z.literal("")),
  allowStatsVisibility: z.boolean().optional(),
  allowHistoryVisibility: z.boolean().optional(),
});
export type ProfilePreferences = z.infer<typeof ProfilePreferencesSchema>;
