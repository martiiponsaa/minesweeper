"use client"; // Add this line at the top

import React, { useState, useEffect } from 'react';
import { where, orderBy } from 'firebase/firestore';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { useSearchParams, useRouter } from 'next/navigation'; // useRouter imported here
import { useFirestoreCollection } from '@/hooks/useFirestoreCollection';
import { Button } from '@/components/ui/button'; // Assuming Button component location
import { useFirestoreDocument } from '@/hooks/useFirestoreDocument';
import { UserSchema, type User as UserType } from '@/lib/firebaseTypes';
import { GameSchema, type Game } from '@/lib/firebaseTypes';

const CompareStatsPage: React.FC = () => {
  const router = useRouter(); // Moved useRouter to the top
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const friendId = searchParams.get('friendId');

  const { data: userGames, loading: userGamesLoading, error: userGamesError } = useFirestoreCollection<Game>(
    'games',
    GameSchema,
    user?.uid ? [where('userId', '==', user.uid), orderBy('startTime', 'desc')] : [],
    !user?.uid
  );

  const { data: friendGames, loading: friendGamesLoading, error: friendGamesError } = useFirestoreCollection<Game>(
    'games',
    GameSchema,
    friendId ? [where('userId', '==', friendId), orderBy('startTime', 'desc')] : [],
    !friendId
  );

  const { data: friendUserData, loading: friendUserLoading, error: friendUserError } = useFirestoreDocument<UserType>(
    'users',
    friendId,
    UserSchema,
  );

  // Placeholder for calculateStats - ideally, import the actual function
  const calculateStats = (games: Game[] | null) => {
      if (!games || games.length === 0) {
          return {
              gamesPlayed: 0,
              wins: 0,
              losses: 0,
              winRate: 0,
              avgSolveTime: 'N/A',
          };
      }

      let wins = 0;
      let losses = 0;
      let totalSolveTime = 0;
      let completedGamesCount = 0;

      games.forEach(game => {
          if (game.result === 'won') {
              wins++;
              if (game.endTime && game.startTime) {
                  totalSolveTime += (game.endTime.toDate().getTime() - game.startTime.toDate().getTime()) / 1000;
                  completedGamesCount++;
              }
          } else if (game.result === 'lost') {
              losses++;
               if (game.endTime && game.startTime) {
                  totalSolveTime += (game.endTime.toDate().getTime() - game.startTime.toDate().getTime()) / 1000;
                  completedGamesCount++;
              }
          }
      });

      const gamesPlayed = games.length;
      const winRate = gamesPlayed > 0 && (wins + losses) > 0 ? parseFloat((wins / (wins + losses)).toFixed(2)) : 0;
      const avgSolveTime = completedGamesCount > 0
          ? (() => {
              const durationInSeconds = Math.round(totalSolveTime / completedGamesCount);
              if (durationInSeconds >= 60) {
                  const minutes = Math.floor(durationInSeconds / 60);
                  const seconds = durationInSeconds % 60;
                  return `${minutes}m ${seconds}s`;
                } else { return `${durationInSeconds}s` }})() : 'N/A';



      return { gamesPlayed, wins, losses, winRate, avgSolveTime };
  };

  const userStats = calculateStats(userGames);
  const friendStats = calculateStats(friendGames);

  const loading = authLoading || userGamesLoading || friendGamesLoading || friendUserLoading;
  const error = userGamesError || friendGamesError;

  if (loading) {
    return (
      <AppLayout>
        <p>Loading comparison...</p>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <p>Error loading stats: {error.message}</p>
      </AppLayout>
    );
  }

  // You might want to fetch user/friend details to display names

    return (
        <AppLayout>
            <div className="container mx-auto p-4">
                <Button onClick={() => router.push('/friends')} className="mb-4">
                    Back to Friends
                </Button>
                <h1 className="text-2xl font-bold mb-4">Stats Comparison</h1>
                {!user || !friendId ? (
                    <p>Please log in and select a friend to compare stats.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stat</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Your Stats</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{friendUserData?.profilePreferences?.displayName || friendUserData?.username || 'Friend'}'s Stats</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {/* Table rows will go here */}
                                <tr className="odd:bg-white even:bg-gray-50 hover:bg-gray-100">
                                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">Games Played</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{userStats.gamesPlayed}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{friendStats.gamesPlayed}</td>
                                </tr>
                                <tr className="odd:bg-white even:bg-gray-50 hover:bg-gray-100">
                                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">Wins</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{userStats.wins}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{friendStats.wins}</td>
                                </tr>
                                <tr className="odd:bg-white even:bg-gray-50 hover:bg-gray-100">
                                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">Losses</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{userStats.losses}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{friendStats.losses}</td>
                                </tr>
                                <tr className="odd:bg-white even:bg-gray-50 hover:bg-gray-100">
                                    <td className="px-6 py-4 whitespace-nowrap">Win Rate</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{(userStats.winRate * 100).toFixed(0)}%</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{(friendStats.winRate * 100).toFixed(0)}%</td>
                                </tr>
                                <tr className="odd:bg-white even:bg-gray-50 hover:bg-gray-100">
                                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">Avg. Solve Time</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{userStats.avgSolveTime}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{friendStats.avgSolveTime}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </AppLayout>
    );
};

export default CompareStatsPage;
