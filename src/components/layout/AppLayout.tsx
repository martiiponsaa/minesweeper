
'use client';

import React, { ReactNode } from 'react';
import {
  SidebarProvider,
  Sidebar,
  SidebarTrigger,
  SidebarInset,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
  SidebarGroup,
  SidebarGroupLabel,
  useSidebar,
} from '@/components/ui/sidebar'; 
import { Home, History, Users, Settings, LogOut, HelpCircle, BarChart3, LogIn, UserPlus } from 'lucide-react'; // Added LogIn, UserPlus
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRouter, usePathname } from 'next/navigation';
import { Label } from "@/components/ui/label"
import { ThemeToggle } from '@/components/ThemeToggle'; // Import ThemeToggle
import { useTheme } from 'next-themes';


const AppLayout: React.FC<{ children: ReactNode }> = ({ children }) => {
   const { user, signOut } = useAuth();
   const router = useRouter();
   const pathname = usePathname();
   
   const { theme } = useTheme();
   const handleSignOut = async () => {
     await signOut();
     router.push('/'); // Redirect to home/login page after sign out
   };

    // Get first letter of email or display name for Avatar fallback
    const getInitials = () => {
      if (user?.displayName) {
        return user.displayName.charAt(0).toUpperCase();
      }
      if (user?.email) {
        return user.email.charAt(0).toUpperCase();
      }
      return 'G'; // Guest fallback
    };

  return (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="icon">
        <SidebarHeader className="items-center group-data-[collapsible=icon]:justify-center">
          <Link href="/dashboard" className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
            {/* Placeholder logo - replace with actual logo */}
            <img src={theme === 'dark' ? '/logo_inverted.svg' : '/logo.svg'}
                alt="MineVerse Logo"
                className="h-12 w-12" />
            <span className="font-semibold text-xl text-primary">MineVerse</span>
          </Link>
          <SidebarTrigger className="md:hidden" /> {/* Trigger only for mobile */}
        </SidebarHeader>

        <SidebarContent className="p-2">
          <SidebarMenu>
            <SidebarMenuItem>
               <SidebarMenuButton asChild isActive={pathname === '/dashboard'} tooltip="Dashboard">
                <Link href="/dashboard">
                  <Home />
                  <span>Dashboard</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
             <SidebarMenuItem>
               <SidebarMenuButton asChild isActive={pathname === '/play'} tooltip="Play">
                 <Link href="/play"> {/* Link to the game page */}
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18.5 3.5a2.12 2.12 0 0 1 3 3L7.4 21.4a2.12 0 0 1-3-3L18.5 3.5z"></path><path d="m12 2-1.9 1.9c-1.5 1.5-1.5 4 0 5.5l4.4 4.4c1.5 1.5 4 1.5 5.5 0L22 12"></path><path d="m2 12 1.9 1.9c1.5 1.5 4 1.5 5.5 0l4.4-4.4c1.5-1.5 1.5-4 0-5.5L12 2"></path><path d="M10.6 10.6 7.4 7.4"></path></svg>
                  <span>Play</span>
                 </Link>
               </SidebarMenuButton>
             </SidebarMenuItem>
             <SidebarMenuItem>
 <SidebarMenuButton asChild isActive={pathname === '/history'} tooltip="History" className={!user ? 'text-gray-400 pointer-events-none' : 'text-foreground data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground'}>
                 <Link href={user ? `/history?id=${user.uid}` : "/history"}>
 <History />
                  <span>History</span>
                 </Link>
               </SidebarMenuButton>
             </SidebarMenuItem>
             <SidebarMenuItem>
 <SidebarMenuButton asChild isActive={pathname === '/stats'} tooltip="Statistics" className={!user ? 'text-gray-400 pointer-events-none' : 'text-foreground data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground'}>
                 <Link href={user ? `/stats?id=${user.uid}` : "/stats"}>
 <BarChart3 />
                  <span>Stats</span>
                 </Link>
               </SidebarMenuButton>
             </SidebarMenuItem>
              <SidebarMenuItem>
 <SidebarMenuButton asChild isActive={pathname === '/friends'} tooltip="Friends" className={!user ? 'text-gray-400 pointer-events-none' : 'text-foreground data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground'}>
                 <Link href="/friends">
                   <Users />
                  <span>Friends</span>
                 </Link>
               </SidebarMenuButton>
             </SidebarMenuItem>
             <SidebarMenuItem>
 <SidebarMenuButton asChild isActive={pathname === '/profile'} tooltip="Profile Settings" className={!user ? 'text-gray-400 pointer-events-none' : 'text-foreground data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground'}>
                 <Link href={user ? `/profile?id=${user.uid}` : "/profile"}>
                   <Settings />
                   <span>Settings</span>
                 </Link>
               </SidebarMenuButton>
             </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>

        <SidebarSeparator />

        <SidebarFooter className="p-2">
           <SidebarMenu>
             <SidebarMenuItem>
                 <SidebarMenuButton onClick={handleSignOut} tooltip="Logout">
                   <LogOut />
                   <span>Logout</span>
                 </SidebarMenuButton>
               </SidebarMenuItem>
           </SidebarMenu>
         </SidebarFooter>
      </Sidebar>

       {/* Main Content Area */}
      <SidebarInset>
         {/* Header within the main content area */}
         <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b bg-background px-4 sm:px-6">
             {/* Mobile Sidebar Trigger */}
             <SidebarTrigger className="sm:hidden"/>

             {/* User Menu or Login/Register Button */}
             <div className="ml-auto flex items-center gap-2"> {/* Changed gap-4 to gap-2 for tighter spacing */}
                 <ThemeToggle /> {/* Added ThemeToggle button */}
                 {user ? ( // If user is logged in, show dropdown
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                                <Avatar className="h-8 w-8">
                                    <AvatarImage src={user.photoURL || undefined} alt={user.displayName || user.email || 'User'} data-ai-hint="profile picture"/>
                                    <AvatarFallback>{getInitials()}</AvatarFallback>
                                </Avatar>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56" align="end" forceMount>
                            <DropdownMenuLabel className="font-normal">
                                <div className="flex flex-col space-y-1">
                                    <p className="text-sm font-medium leading-none">
                                        {user.displayName || 'User'}
                                    </p>
                                    <p className="text-xs leading-none text-muted-foreground">
                                        {user.email || 'Authenticated User'}
                                    </p>
                                </div>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => router.push(`/profile?id=${user.uid}`)}>
                                <Settings className="mr-2 h-4 w-4" />
                                <span>Settings</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={handleSignOut}>
                                <LogOut className="mr-2 h-4 w-4" />
                                <span>Log out</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                 ) : ( 
                   <Button variant="outline" onClick={() => router.push('/register')}>
                     <UserPlus className="mr-2 h-4 w-4" />
                     Register
                   </Button>
                 )}
             </div>
         </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
};

export default AppLayout;
