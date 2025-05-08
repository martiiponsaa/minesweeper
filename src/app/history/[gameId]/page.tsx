
// src/app/history/[gameId]/page.tsx
// NO 'use client' here

import GameReviewClient from '@/components/history/GameReviewClient';

// generateStaticParams is required for dynamic routes when using `output: 'export'`.
// Returning an empty array means no specific game paths are pre-rendered at build time.
// Pages will be generated on-demand or when linked from other pre-rendered pages.
export async function generateStaticParams() {
  return [];
}

export default function GameReviewPage({ params }: { params: { gameId: string } }) {
  return <GameReviewClient gameId={params.gameId} />;
}

