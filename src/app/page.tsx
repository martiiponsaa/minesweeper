'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth'; // Import useAuth hook

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth(); // Use the auth hook

  useEffect(() => {
    if (!loading) { // Only redirect once loading is complete
      if (user) {
        router.replace('/dashboard'); // If user is logged in, redirect to dashboard
      } else {
        router.replace('/login'); // If user is not logged in, redirect to login
      }
    }
  }, [user, loading, router]);

  // Render a loading indicator or null while checking auth state and redirecting
  return (
     <div className="flex items-center justify-center min-h-screen">
       Loading...
     </div>
  );
}
