import { collection, doc, type Firestore, getDocs } from 'firebase/firestore';

// User Collection Reference
export const getUsersCollection = (db: Firestore) => collection(db, 'users');
export const getUserDoc = (db: Firestore, userId: string) => doc(db, 'users', userId);

// Game Collection Reference
export const getGamesCollection = (db: Firestore) => collection(db, 'games');
export const getGameDoc = (db: Firestore, gameId: string) => doc(db, 'games', gameId);

// Friend Request Collection Reference
export const getFriendRequestsCollection = (db: Firestore) => collection(db, 'friendRequests');
export const getFriendRequestDoc = (db: Firestore, friendRequestId: string) => doc(db, 'friendRequests', friendRequestId);


/**
 * Fetches all game IDs from the 'games' collection.
 * @param db - The Firestore instance.
 * @returns An array of game IDs, or an empty array if an error occurs.
 */
export async function getAllGameIds(db: Firestore): Promise<string[]> {
    try {
        const gamesCollection = collection(db, 'games');
        const querySnapshot = await getDocs(gamesCollection);
        return querySnapshot.docs.map(doc => doc.id);
    } catch (error) {
        console.error("Error fetching all game IDs:", error);
        return [];
    }
}
