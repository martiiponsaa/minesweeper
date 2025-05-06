import { z } from 'zod';
import type { Timestamp } from 'firebase/firestore';

// Firestore Timestamp type for Zod
const timestampSchema = z.custom<Timestamp>((data) => data instanceof Object && 'toDate' in data && typeof data.toDate === 'function', {
  message: 'Expected Firestore Timestamp',
});

// User Entity
export const UserSchema = z.object({
  id: z.string(),
  username: z.string().optional(), // Made optional to accommodate initial Google/Guest sign-in
  email: z.string().email().nullable().optional(), // Added email field, can be null for anonymous
  // password is not stored directly in Firestore, handled by Firebase Auth
  profilePreferences: z.object({
    displayName: z.string().optional(),
    avatar: z.string().optional(), // URL or identifier for avatar
  }).optional(),
  friendCodes: z.array(z.string()).optional(),
  friendIds: z.array(z.string()).optional(), // Array of user IDs
});

export type User = z.infer<typeof UserSchema>;


// Game Move Entity (Sub-object within Game)
export const MoveSchema = z.object({
  timestamp: timestampSchema,
  action: z.string(), // e.g., 'click', 'flag'
  x: z.number().int(),
  y: z.number().int(),
});

export type Move = z.infer<typeof MoveSchema>;

// Game Entity
export const GameSchema = z.object({
  id: z.string(),
  userId: z.string(),
  startTime: timestampSchema,
  endTime: timestampSchema.nullable(),
  gameState: z.string(), // Serialized game board state (JSON string or similar)
  difficulty: z.string(), // e.g., 'easy', 'medium', 'hard'
  moves: z.array(MoveSchema).optional(),
  result: z.string().nullable(), // e.g., 'won', 'lost', 'quit'
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
  avatar: z.string().url("Invalid avatar URL").optional().or(z.literal("")), // Allow empty string to clear
});
export type ProfilePreferences = z.infer<typeof ProfilePreferencesSchema>;
