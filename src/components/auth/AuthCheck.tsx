'use client';

 import React, { ReactNode } from 'react';
 import { useAuth } from '@/hooks/useAuth';
 import { useRouter } from 'next/navigation';

 type AuthCheckProps = {
   children: ReactNode;
   fallback?: ReactNode; // Optional fallback component while loading or if not authenticated
   redirectTo?: string; // Optional path to redirect if not authenticated
 };

 export const AuthCheck: React.FC<AuthCheckProps> = ({ children, fallback = null, redirectTo = '/' }) => {
   const { user, loading } = useAuth();
   const router = useRouter();

   React.useEffect(() => {
     if (!loading && !user && redirectTo) {
       router.replace(redirectTo);
     }
   }, [user, loading, router, redirectTo]);

   if (loading) {
     // Render fallback or a default loading state
     return fallback || <div className="flex items-center justify-center min-h-screen">Loading...</div>;
   }

   if (user) {
     // User is authenticated, render the children
     return <>{children}</>;
   }

   // User is not authenticated, render fallback or nothing (useEffect handles redirect)
   return fallback;
 };
