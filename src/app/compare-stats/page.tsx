
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useFirestoreCollection } from "@/hooks/useFirestoreCollection";
import { collection, query, where } from "firebase/firestore";
import { getFirebase } from "@/firebase"; // Import getFirebase
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface AverageStats {
  totalWins: number;
  totalLosses: number;
  winRate: number;
  averageScore: number;
  averageTime: number;
}

import { FirestoreUser, FriendshipLink } from "@/lib/firebaseTypes"; 
const CompareStatsPage = () => {
  const { user } = useAuth();
  const { firestore } = getFirebase(); // Initialize Firestore
  const [friendStats, setFriendStats] = useState<FirestoreUser[]>([]);
  const [averageFriendStats, setAverageFriendStats] = useState<AverageStats | null>(null);

  const { data: friendsList, loading: friendsLoading } = useFirestoreCollection(
    user ? query(collection(firestore, "friendships"), where("users", "array-contains", user.uid)) : null
  );

  const friendIds = friendsList
    ?.map((link: FriendshipLink) => link.users.find((id) => id !== user?.uid))
    .filter(Boolean) as string[];

  const { data: friendsProfiles, loading: friendsProfilesLoading } = useFirestoreCollection(
    friendIds && friendIds.length > 0 ? query(collection(firestore, "users"), where("id", "in", friendIds)) : null
  );

  useEffect(() => {
    if (friendsProfiles && friendsProfiles.length > 0) {
      setFriendStats(friendsProfiles as FirestoreUser[]);
    }
  }, [friendsProfiles]);

  useEffect(() => {
    if (friendStats.length > 0) {
      const totalWins = friendStats.reduce((sum, friend) => sum + (friend.stats?.totalWins || 0), 0);
      const totalLosses = friendStats.reduce((sum, friend) => sum + (friend.stats?.totalLosses || 0), 0);
      const totalScore = friendStats.reduce((sum, friend) => sum + (friend.stats?.totalScore || 0), 0);
      const totalTime = friendStats.reduce((sum, friend) => sum + (friend.stats?.totalTime || 0), 0);

      const averageStats: AverageStats = {
        totalWins: totalWins / friendStats.length,
        totalLosses: totalLosses / friendStats.length,
        winRate: (totalWins / (totalWins + totalLosses)) * 100 || 0,
        averageScore: totalScore / friendStats.length || 0,
        averageTime: totalTime / friendStats.length || 0,
      };
      setAverageFriendStats(averageStats);
    } else {
      setAverageFriendStats(null);
    }
  }, [friendStats]);

  if (!user) {
    return <div className="text-center py-10">Please log in to compare stats.</div>;
  }

  if (friendsLoading || friendsProfilesLoading) {
    return <div className="text-center py-10">Loading stats...</div>;
  }

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-8 text-center">Compare Stats</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Your Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Your Stats</CardTitle>
          </CardHeader>
          <CardContent>
            {user.stats ? (
              <Table>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Total Wins</TableCell>
                    <TableCell>{user.stats.totalWins}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Total Losses</TableCell>
                    <TableCell>{user.stats.totalLosses}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Win Rate</TableCell>
                    <TableCell>{user.stats.winRate.toFixed(2)}%</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Average Score</TableCell>
                    <TableCell>{user.stats.averageScore.toFixed(2)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Average Time (seconds)</TableCell>
                    <TableCell>{user.stats.averageTime.toFixed(2)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            ) : (
              <p>No stats available yet. Play some games!</p>
            )}
          </CardContent>
        </Card>

        {/* Average Friend Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Average Friend Stats</CardTitle>
          </CardHeader>
          <CardContent>
            {averageFriendStats ? (
              <Table>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Total Wins</TableCell>
                    <TableCell>{averageFriendStats.totalWins.toFixed(2)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Total Losses</TableCell>
                    <TableCell>{averageFriendStats.totalLosses.toFixed(2)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Win Rate</TableCell>
                    <TableCell>{averageFriendStats.winRate.toFixed(2)}%</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Average Score</TableCell>
                    <TableCell>{averageFriendStats.averageScore.toFixed(2)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Average Time (seconds)</TableCell>
                    <TableCell>{averageFriendStats.averageTime.toFixed(2)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            ) : (
              <div className="text-center text-muted-foreground py-10">
                <p>Add friends to see their average stats!</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CompareStatsPage;
