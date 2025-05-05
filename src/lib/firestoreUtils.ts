import { collection, doc, type Firestore } from 'firebase/firestore';

// User Collection Reference
export const getUsersCollection = (db: Firestore) => collection(db, 'users');
export const getUserDoc = (db: Firestore, userId: string) => doc(db, 'users', userId);

// Game Collection Reference
export const getGamesCollection = (db: Firestore) => collection(db, 'games');
export const getGameDoc = (db: Firestore, gameId: string) => doc(db, 'games', gameId);

// Friend Request Collection Reference
export const getFriendRequestsCollection = (db: Firestore) => collection(db, 'friendRequests');
export const getFriendRequestDoc = (db: Firestore, friendRequestId: string) => doc(db, 'friendRequests', friendRequestId);
