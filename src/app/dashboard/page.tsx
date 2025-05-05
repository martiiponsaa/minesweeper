'use client';

import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import { Skeleton } from '@/components/ui/skeleton'; // Import Skeleton

export default function DashboardPage() {
  const { user, signOut, loading } = useAuth(); // Keep loading state
  const router = useRouter();

  // Show skeleton while loading user data
  if (loading) {
      return (
         <AppLayout>
           <div className="container mx-auto p-4 md:p-8 space-y-8">
              <div className="flex justify-between items-center">
                <Skeleton className="h-10 w-1/3" />
                <Skeleton className="h-10 w-24" />
              </div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               <Skeleton className="h-40 rounded-lg" />
               <Skeleton className="h-40 rounded-lg" />
               <Skeleton className="h-40 rounded-lg" />
                <Skeleton className="h-40 rounded-lg md:col-span-2 lg:col-span-1" />
                <Skeleton className="h-40 rounded-lg md:col-span-2" />
              </div>
           </div>
         </AppLayout>
       );
  }


  return (
    // Removed AuthCheck wrapper
    <AppLayout>
      <div className="container mx-auto p-4 md:p-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-foreground">
            {/* Use optional chaining as user might be null now */}
            Welcome, {user?.displayName || user?.email || 'User'}!
          </h1>
          {/* Show login button if no user, logout if user exists */}
           {user ? (
             <Button onClick={signOut} variant="outline">Logout</Button>
           ) : (
             <Button onClick={() => router.push('/login')} variant="outline">Login</Button>
           )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Placeholder for Game Start/Continue */}
          <div className="bg-card p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4 text-card-foreground">Play MineVerse</h2>
            <p className="text-muted-foreground mb-4">Start a new game or continue your last one.</p>
            <Button className="w-full bg-primary hover:bg-primary/90" onClick={() => router.push('/play')}>New Game</Button>
            {/* Add Continue Game button logic later */}
          </div>

          {/* Placeholder for Game History */}
          <div className="bg-card p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4 text-card-foreground">Match History</h2>
            <p className="text-muted-foreground mb-4">Review your past games and performance.</p>
            <Button variant="secondary" className="w-full" onClick={() => router.push('/history')}>View History</Button>
          </div>

          {/* Placeholder for Friends */}
          <div className="bg-card p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4 text-card-foreground">Friends</h2>
            <p className="text-muted-foreground mb-4">Connect with friends and compare stats.</p>
            <Button variant="secondary" className="w-full" onClick={() => router.push('/friends')}>Manage Friends</Button>
          </div>

          {/* Placeholder for Profile/Settings */}
          <div className="bg-card p-6 rounded-lg shadow-md md:col-span-2 lg:col-span-1">
            <h2 className="text-xl font-semibold mb-4 text-card-foreground">Profile</h2>
            <p className="text-muted-foreground mb-4">Manage your account settings and preferences.</p>
            <Button variant="secondary" className="w-full" onClick={() => router.push('/profile')}>Edit Profile</Button>
          </div>

          {/* Placeholder for Statistics */}
          <div className="bg-card p-6 rounded-lg shadow-md md:col-span-2">
            <h2 className="text-xl font-semibold mb-4 text-card-foreground">Your Stats</h2>
            <p className="text-muted-foreground mb-4">See your overall performance trends.</p>
            {/* Add Chart components here later */}
            <div className="h-40 bg-muted rounded flex items-center justify-center text-muted-foreground">
              Charts coming soon!
            </div>
          </div>

        </div>
      </div>
    </AppLayout>
  );
}
