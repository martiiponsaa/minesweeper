'use client';

import React, { ReactNode } from 'react';
import { AuthProvider } from '@/hooks/useAuth';
import { Toaster } from "@/components/ui/toaster"

// Import other providers as needed
// import { AnotherProvider } from '@/hooks/useAnother';

type ProvidersProps = {
  children: ReactNode;
};

export const Providers: React.FC<ProvidersProps> = ({ children }) => {
  return (
    <AuthProvider>
      {/* Wrap with other providers here */}
      {/* <AnotherProvider> */}
        {children}
        <Toaster />
      {/* </AnotherProvider> */}
    </AuthProvider>
  );
};
