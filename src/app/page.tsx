'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth'; // Import useAuth hook

export default function HomePage() {
  const router = useRouter();
  // const { user, loading } = useAuth(); // No longer need user/loading for initial redirect

  useEffect(() => {
    // Redirect immediately to the dashboard regardless of auth state
    router.replace('/dashboard');
    // }, [user, loading, router]); // Original dependencies
  }, [router]); // Only depend on router

  // Render a simple loading indicator while redirecting
  return (
     <div className="flex items-center justify-center min-h-screen">
       Loading...
     </div>
  );
}
