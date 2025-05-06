'use client';

import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
// import { Skeleton } from '@/components/ui/skeleton'; // Skeleton no longer needed for auth loading

export default function DashboardPage() {
  const { user, signOut } = useAuth(); // Remove loading state if not used elsewhere
  const router = useRouter();

  // // Show skeleton while loading user data - Removed as per request
  // if (loading) {
  //     return (
  //        <AppLayout>
  //          <div className="container mx-auto p-4 md:p-8 space-y-8">
  //             <div className="flex justify-between items-center">
  //               <Skeleton className="h-10 w-1/3" />
  //               <Skeleton className="h-10 w-24" />
  //             </div>
  //            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  //              <Skeleton className="h-40 rounded-lg" />
  //              <Skeleton className="h-40 rounded-lg" />
  //              <Skeleton className="h-40 rounded-lg" />
  //               <Skeleton className="h-40 rounded-lg md:col-span-2 lg:col-span-1" />
  //               <Skeleton className="h-40 rounded-lg md:col-span-2" />
  //             </div>
  //          </div>
  //        </AppLayout>
  //      );
  // }


  return (
    <AppLayout>
      <div className="container mx-auto p-4 md:p-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-foreground">
            {/* Handle null user case (Guest) */}
            Welcome, {user?.displayName || user?.email || 'Guest'}!
          </h1>
          {/* Show login button if no user (guest), logout if user exists */}
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
            {/* Add Continue Game button logic later - will be disabled for guests implicitly or explicitly */}
          </div>

          {/* Placeholder for Game History */}
          <div className="bg-card p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4 text-card-foreground">Match History</h2>
            <p className="text-muted-foreground mb-4">
              {user ? "Review your past games and performance." : "Register to save and review your game history."}
            </p>
            <Button variant="secondary" className="w-full" onClick={() => router.push(user ? '/history' : '/register')}>
              {user ? "View History" : "Register to View History"}
            </Button>
          </div>

          {/* Placeholder for Friends */}
          <div className="bg-card p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4 text-card-foreground">Friends</h2>
            <p className="text-muted-foreground mb-4">
              {user ? "Connect with friends and compare stats." : "Register to connect with friends."}
            </p>
            <Button variant="secondary" className="w-full" onClick={() => router.push(user ? '/friends' : '/register')}>
              {user ? "Manage Friends" : "Register for Friends"}
            </Button>
          </div>

          {/* Placeholder for Profile/Settings */}
          <div className="bg-card p-6 rounded-lg shadow-md md:col-span-2 lg:col-span-1">
            <h2 className="text-xl font-semibold mb-4 text-card-foreground">Profile</h2>
            <p className="text-muted-foreground mb-4">
              {user ? "Manage your account settings and preferences." : "Register to create a profile."}
            </p>
            <Button variant="secondary" className="w-full" onClick={() => router.push(user ? '/profile' : '/register')}>
              {user ? "Edit Profile" : "Register for Profile"}
            </Button>
          </div>

          {/* Placeholder for Statistics */}
          <div className="bg-card p-6 rounded-lg shadow-md md:col-span-2">
            <h2 className="text-xl font-semibold mb-4 text-card-foreground">Your Stats</h2>
            <p className="text-muted-foreground mb-4">
              {user ? "See your overall performance trends." : "Register to track your statistics."}
            </p>
            {user ? (
                <div className="h-40 bg-muted rounded flex items-center justify-center text-muted-foreground">
                  Charts coming soon!
                </div>
            ) : (
                <div className="h-40 bg-muted rounded flex items-center justify-center text-muted-foreground">
                  Register to see your stats!
                </div>
            )}
             <Button variant="secondary" className="w-full mt-4" onClick={() => router.push(user ? '/stats' : '/register')}>
              {user ? "View All Stats" : "Register for Stats"}
            </Button>
          </div>

        </div>
      </div>
    </AppLayout>
  );
}
