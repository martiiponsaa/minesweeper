'use client';
 import AppLayout from '@/components/layout/AppLayout';
 import { useAuth } from '@/hooks/useAuth';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label'; // Import Label
 import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
 import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
 import { Separator } from '@/components/ui/separator';
 import { UserPlus, Check, X, Users } from 'lucide-react'; // Added Users icon
 import { useState } from 'react';
 import { useRouter } from 'next/navigation'; // Import useRouter

 export default function FriendsPage() {
    const { user } = useAuth();
    const [friendCode, setFriendCode] = useState('');
    const router = useRouter(); // Initialize useRouter

    const handleAddFriend = () => {
        console.log("Adding friend with code:", friendCode);
        // TODO: Implement logic to send friend request using the friendCode
        setFriendCode(''); // Clear input after attempting to add
    };

   return (
     <AppLayout>
       {!user ? ( // Check if user is a guest (null)
         <div className="container mx-auto p-4 md:p-8 flex flex-col items-center justify-center text-center">
           <Users className="h-16 w-16 text-muted-foreground mb-4" />
           <h1 className="text-2xl font-bold text-foreground mb-3">Manage Your Friends</h1>
           <p className="text-muted-foreground mb-6 max-w-md">
             To add friends, view your friends list, and manage friend requests, please create an account or log in. Playing as a guest does not allow access to social features.
           </p>
           <Button onClick={() => router.push('/register')}>
             Register or Login
           </Button>
         </div>
       ) : (
         // Original content for logged-in users
         <div className="container mx-auto p-4 md:p-8">
           <h1 className="text-3xl font-bold text-foreground mb-8">Friends</h1>

           <Tabs defaultValue="my-friends" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-6">
                  <TabsTrigger value="my-friends">My Friends</TabsTrigger>
                  <TabsTrigger value="add-friend">Add Friend</TabsTrigger>
                  <TabsTrigger value="requests">Requests</TabsTrigger>
              </TabsList>

               {/* My Friends Tab */}
               <TabsContent value="my-friends">
                  <Card>
                      <CardHeader>
                          <CardTitle>Your Friends</CardTitle>
                          <CardDescription>View your friends list and compare stats.</CardDescription>
                      </CardHeader>
                      <CardContent>
                           {/* Placeholder */}
                            <div className="text-center text-muted-foreground py-10">
                              <p>Your friends list is empty.</p>
                              <p className="mt-2">Add friends using their friend code!</p>
                            </div>
                            {/* TODO: Implement displaying friends list */}
                       </CardContent>
                  </Card>
               </TabsContent>

                {/* Add Friend Tab */}
                <TabsContent value="add-friend">
                   <Card>
                       <CardHeader>
                           <CardTitle>Add a New Friend</CardTitle>
                           <CardDescription>Enter your friend's unique code to send a request.</CardDescription>
                       </CardHeader>
                       <CardContent className="space-y-4">
                          <div>
                              <Label htmlFor="friendCode" className="mb-2 block">Your Friend Code:</Label>
                               {/* TODO: Display user's actual friend code */}
                               <Input type="text" value="YOUR-CODE-XYZ" readOnly className="bg-muted cursor-not-allowed" />
                                <p className="text-xs text-muted-foreground mt-1">Share this code with others so they can add you.</p>
                          </div>
                           <Separator />
                           <div>
                               <Label htmlFor="addFriendCode" className="mb-2 block">Enter Friend's Code:</Label>
                              <div className="flex gap-2">
                                  <Input
                                      id="addFriendCode"
                                      placeholder="Enter friend code"
                                      value={friendCode}
                                       onChange={(e) => setFriendCode(e.target.value)}
                                   />
                                  <Button onClick={handleAddFriend} disabled={!friendCode}>
                                       <UserPlus className="mr-2 h-4 w-4" /> Add Friend
                                   </Button>
                              </div>
                           </div>
                       </CardContent>
                   </Card>
                </TabsContent>

                {/* Requests Tab */}
                <TabsContent value="requests">
                   <Card>
                       <CardHeader>
                           <CardTitle>Friend Requests</CardTitle>
                           <CardDescription>Manage incoming friend requests.</CardDescription>
                       </CardHeader>
                       <CardContent>
                            {/* Placeholder */}
                            <div className="text-center text-muted-foreground py-10">
                              <p>No pending friend requests.</p>
                            </div>
                            {/* TODO: Implement displaying and handling friend requests */}
                       </CardContent>
                   </Card>
                </TabsContent>
           </Tabs>
         </div>
       )}
     </AppLayout>
   );
 }
