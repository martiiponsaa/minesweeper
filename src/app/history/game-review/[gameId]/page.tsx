// src/app/history/game-review/[gameId]/page.tsx
// NO 'use client' here
import React from 'react';

import GameReviewClient from '@/components/history/GameReviewClient';
// Firebase related imports for generateStaticParams (if used) are removed or handled server-side.

// generateStaticParams is removed to rely on server-side rendering for dynamic routes.
// If pre-rendering specific paths is needed later, ensure generateStaticParams
// does not call client-side Firebase initialization (like getFirebase()) directly.
// For now, dynamic paths will be rendered on demand by the Firebase Function.

const GameReviewPage: React.FC<{ params: { gameId: string } }> = ({ params }) => {
    return <GameReviewClient gameId={params.gameId} />;
};
export default GameReviewPage;
