// src/app/history/game-review/[gameId]/page.tsx
// NO 'use client' here

import GameReviewClient from '@/components/history/GameReviewClient';
import { getAllGameIds } from '@/lib/firestoreUtils';
import { getFirebase } from '@/firebase';

// generateStaticParams is required for dynamic routes when using `output: 'export'`.
// Returning an empty array means no specific game paths are pre-rendered at build time.
// Pages will be generated on-demand or when linked from other pre-rendered pages.
export async function generateStaticParams() {
  const { firestore } = getFirebase();
  if (!firestore) {
    console.error('Firestore is not available.');
    return [];
  }
  try {
    const gameIds = await getAllGameIds(firestore);
    return gameIds.map((id) => ({ gameId: id }));
  } catch (error) {
    console.error('Error fetching game IDs:', error);
    return [];
  }
}

export default function GameReviewPage({ params }: { params: { gameId: string } }) {
  return <GameReviewClient gameId={params.gameId} />;
}
