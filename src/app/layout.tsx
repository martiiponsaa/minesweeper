import type {Metadata} from 'next';
import {Geist, Geist_Mono} from 'next/font/google';
import { ThemeProvider } from 'next-themes'; // Import ThemeProvider
import { ThemeProviderWrapper } from '@/components/ThemeProviderWrapper'; // Import ThemeProviderWrapper
import './globals.css';
import { Providers } from '@/components/Providers'; // Import the Providers component

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'MineVerse', // Updated title
  description: 'A modern take on Minesweeper with social features.', // Updated description
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) { 
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProviderWrapper>
          <Providers> {/* Wrap children with Providers */}
            {children}
          </Providers>
        </ThemeProviderWrapper>
      </body>
    </html>
  );
}
