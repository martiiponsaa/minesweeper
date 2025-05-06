
'use client';
 import AppLayout from '@/components/layout/AppLayout';
 import { useAuth } from '@/hooks/useAuth';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
 import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
 import { Separator } from '@/components/ui/separator';
 import { UserPlus, Check, X, Users, Eye } from 'lucide-react';
 import { useState, useEffect } from 'react';
 import { useRouter } from 'next/navigation';
 import { useFirestoreDocument } from '@/hooks/useFirestoreDocument';
 import { UserSchema, type User as UserType } from '@/lib/firebaseTypes';
 import { useFirestoreCollection } from '@/hooks/useFirestoreCollection';
 import { getFirebase } from '@/firebase';
 import { doc, updateDoc, arrayUnion, query, where, getDocs, collection, writeBatch, serverTimestamp, setDoc, limit } from 'firebase/firestore';
 import { useToast } from '@/hooks/use-toast';
 import { FriendRequestSchema, type FriendRequest } from '@/lib/firebaseTypes';
 import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
 import { generateRandomFriendCode } from '@/lib/utils';

 export default function FriendsPage() {
    const { user } = useAuth();
    const { firestore } = getFirebase();
    const { toast } = useToast();
    const router = useRouter();

    const [friendCodeToAdd, setFriendCodeToAdd] = useState('');

    // Fetch current user's data to get their actual friend code and friends list
    const { data: currentUserData, loading: currentUserLoading, error: currentUserError } = useFirestoreDocument<UserType>(
      'users',
      user?.uid,
      UserSchema
    );

    // Effect to generate and save userFriendCode if it's missing
    useEffect(() => {
        if (user && firestore && currentUserData && !currentUserLoading && !currentUserData.userFriendCode && !currentUserError) {
            console.log("Attempting to generate and save missing userFriendCode for user:", user.uid);
            const userDocRef = doc(firestore, 'users', user.uid);
            const newUserFriendCode = generateRandomFriendCode();

            updateDoc(userDocRef, { userFriendCode: newUserFriendCode })
                .then(() => {
                    toast({ title: "Friend Code Generated", description: "Your friend code is now available." });
                    // Data will auto-update due to onSnapshot in useFirestoreDocument
                })
                .catch((error) => {
                    console.error("Error updating userFriendCode:", error);
                    toast({ title: "Error", description: "Could not generate your friend code. Please try reloading.", variant: "destructive" });
                });
        }
    }, [user, firestore, currentUserData, currentUserLoading, currentUserError, toast]);


    // Fetch profiles of users whose UIDs are in the current user's friendIds list
    const { data: friendsProfiles, loading: friendsProfilesLoading } = useFirestoreCollection<UserType>(
        'users',
        UserSchema,
        currentUserData?.friendIds && currentUserData.friendIds.length > 0
            ? [where('id', 'in', currentUserData.friendIds)]
            : [], // Empty constraints if no friendIds or they are not loaded yet
        !currentUserData?.friendIds || currentUserData.friendIds.length === 0 // Disable if no friend IDs
    );

    // Fetch pending friend requests where the current user is the recipient
    const { data: incomingRequests, loading: incomingRequestsLoading, refetch: refetchIncomingRequests } = useFirestoreCollection<FriendRequest>(
        'friendRequests',
        FriendRequestSchema,
        user ? [where('recipientId', '==', user.uid), where('status', '==', 'pending')] : [],
        !user
    );

    // Fetch pending friend requests sent by the current user
     const { data: outgoingRequests, loading: outgoingRequestsLoading, refetch: refetchOutgoingRequests } = useFirestoreCollection<FriendRequest>(
        'friendRequests',
        FriendRequestSchema,
        user ? [where('requesterId', '==', user.uid), where('status', '==', 'pending')] : [],
        !user
    );


    const handleAddFriend = async () => {
        if (!user || !firestore || !currentUserData?.userFriendCode) {
            toast({ title: "Error", description: "Cannot add friend. Ensure you are logged in and your friend code is available.", variant: "destructive" });
            return;
        }
        if (friendCodeToAdd === currentUserData.userFriendCode) {
            toast({ title: "Cannot Add Self", description: "You cannot add yourself as a friend.", variant: "destructive" });
            setFriendCodeToAdd('');
            return;
        }

        try {
            // Check if a request already exists (either way)
            const existingRequestQuery1 = query(collection(firestore, 'friendRequests'),
                where('requesterId', '==', user.uid),
                where('recipientFriendCode', '==', friendCodeToAdd),
                where('status', '==', 'pending')
            );
            const existingRequestQuery2 = query(collection(firestore, 'friendRequests'),
                where('recipientId', '==', user.uid),
                where('requesterFriendCode', '==', friendCodeToAdd),
                where('status', '==', 'pending')
            );

            const [snapshot1, snapshot2] = await Promise.all([getDocs(existingRequestQuery1), getDocs(existingRequestQuery2)]);

            if (!snapshot1.empty || !snapshot2.empty) {
                toast({ title: "Request Pending", description: "A friend request already exists with this user.", variant: "info" });
                setFriendCodeToAdd('');
                return;
            }

            // Find the recipient user by their friend code
            const usersRef = collection(firestore, 'users');
            const q = query(usersRef, where('userFriendCode', '==', friendCodeToAdd), limit(1));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                toast({ title: "User Not Found", description: "No user found with this friend code.", variant: "destructive" });
                setFriendCodeToAdd('');
                return;
            }
            const recipientUserDoc = querySnapshot.docs[0];
            const recipientUserData = recipientUserDoc.data() as UserType;

            if (recipientUserData.id === user.uid) {
                 toast({ title: "Cannot Add Self", description: "You cannot add yourself as a friend.", variant: "destructive" });
                 setFriendCodeToAdd('');
                 return;
            }
             // Check if already friends
            if (currentUserData.friendIds?.includes(recipientUserData.id)) {
                toast({ title: "Already Friends", description: "You are already friends with this user.", variant: "info" });
                setFriendCodeToAdd('');
                return;
            }


            // Create new friend request
            const newRequestRef = doc(collection(firestore, 'friendRequests'));
            const newRequest: Omit<FriendRequest, 'id'> = { // Firestore will auto-generate ID
                requesterId: user.uid,
                recipientId: recipientUserData.id,
                status: 'pending',
                requesterFriendCode: currentUserData.userFriendCode,
                recipientFriendCode: recipientUserData.userFriendCode,
                // No need to set 'id' here explicitly when using doc(collection(...))
            };
            await setDoc(newRequestRef, newRequest);

            toast({ title: "Friend Request Sent", description: `Request sent to user with code ${friendCodeToAdd}.` });
            setFriendCodeToAdd('');
            refetchOutgoingRequests(); // Refresh outgoing requests list
        } catch (error) {
            console.error("Error sending friend request:", error);
            toast({ title: "Error", description: "Could not send friend request.", variant: "destructive" });
        }
    };

    const handleFriendRequest = async (request: FriendRequest, action: 'accept' | 'reject') => {
        if (!user || !firestore) return;

        const requestDocRef = doc(firestore, 'friendRequests', request.id);

        try {
            if (action === 'accept') {
                const batch = writeBatch(firestore);
                // Update request status
                batch.update(requestDocRef, { status: 'accepted' });

                // Add to both users' friend lists
                const currentUserDocRef = doc(firestore, 'users', user.uid);
                const requesterUserDocRef = doc(firestore, 'users', request.requesterId);

                batch.update(currentUserDocRef, { friendIds: arrayUnion(request.requesterId) });
                batch.update(requesterUserDocRef, { friendIds: arrayUnion(user.uid) });

                await batch.commit();
                toast({ title: "Friend Added", description: "You are now friends!" });
            } else { // reject
                await updateDoc(requestDocRef, { status: 'rejected' });
                toast({ title: "Request Rejected", description: "Friend request has been rejected." });
            }
            refetchIncomingRequests(); // Refresh the list of incoming requests
        } catch (error) {
            console.error(`Error ${action}ing friend request:`, error);
            toast({ title: "Error", description: `Could not ${action} friend request.`, variant: "destructive" });
        }
    };

    const getInitials = (name?: string, email?: string) => {
      if (name) return name.charAt(0).toUpperCase();
      if (email) return email.charAt(0).toUpperCase();
      return '?';
    };


   return (
     <AppLayout>
       {!user ? (
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
         <div className="container mx-auto p-4 md:p-8">
           <h1 className="text-3xl font-bold text-foreground mb-8">Friends</h1>

           <Tabs defaultValue="my-friends" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-6">
                  <TabsTrigger value="my-friends">My Friends ({friendsProfiles.length})</TabsTrigger>
                  <TabsTrigger value="add-friend">Add Friend</TabsTrigger>
                  <TabsTrigger value="requests">Requests ({incomingRequests.filter(req => req.status === 'pending').length})</TabsTrigger>
              </TabsList>

               <TabsContent value="my-friends">
                  <Card>
                      <CardHeader>
                          <CardTitle>Your Friends</CardTitle>
                          <CardDescription>View your friends list and their profiles.</CardDescription>
                      </CardHeader>
                      <CardContent>
                           {currentUserLoading || friendsProfilesLoading ? (
                             <p>Loading friends...</p>
                           ) : friendsProfiles.length === 0 ? (
                            <div className="text-center text-muted-foreground py-10">
                              <p>Your friends list is empty.</p>
                              <p className="mt-2">Add friends using their friend code in the "Add Friend" tab!</p>
                            </div>
                           ) : (
                             <ul className="space-y-3">
                                {friendsProfiles.map(friend => (
                                  <li key={friend.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
                                    <div className="flex items-center gap-3">
                                       <Avatar>
                                         <AvatarImage src={friend.profilePreferences?.avatar || undefined} alt={friend.profilePreferences?.displayName || friend.username || 'Friend'} data-ai-hint="profile picture"/>
                                         <AvatarFallback>{getInitials(friend.profilePreferences?.displayName || friend.username, friend.email)}</AvatarFallback>
                                       </Avatar>
                                       <div>
                                         <p className="font-semibold text-foreground">{friend.profilePreferences?.displayName || friend.username || 'Unnamed Friend'}</p>
                                         <p className="text-xs text-muted-foreground">@{friend.username || friend.userFriendCode}</p>
                                       </div>
                                    </div>
                                    <Button variant="outline" size="sm" onClick={() => router.push(`/profile/${friend.id}`)} title="View Friend's Profile">
                                        <Eye className="mr-1 h-4 w-4" /> Profile
                                    </Button>
                                  </li>
                                ))}
                             </ul>
                           )}
                       </CardContent>
                  </Card>
               </TabsContent>

                <TabsContent value="add-friend">
                   <Card>
                       <CardHeader>
                           <CardTitle>Add a New Friend</CardTitle>
                           <CardDescription>Enter your friend's unique code to send a request.</CardDescription>
                       </CardHeader>
                       <CardContent className="space-y-4">
                          <div>
                              <Label htmlFor="myFriendCode" className="mb-2 block">Your Friend Code:</Label>
                               <Input
                                  id="myFriendCode"
                                  type="text"
                                  value={currentUserLoading ? "Loading..." : (!currentUserData?.userFriendCode ? "Generating..." : currentUserData.userFriendCode)}
                                  readOnly
                                  className="bg-muted cursor-pointer"
                                  onClick={() => {
                                    if (currentUserData?.userFriendCode) {
                                        navigator.clipboard.writeText(currentUserData.userFriendCode);
                                        toast({title: "Copied!", description: "Your friend code has been copied to the clipboard."});
                                    }
                                  }}
                                  title="Click to copy your friend code"
                                />
                                <p className="text-xs text-muted-foreground mt-1">Share this code with others so they can add you.</p>
                          </div>
                           <Separator />
                           <div>
                               <Label htmlFor="addFriendCode" className="mb-2 block">Enter Friend's Code:</Label>
                              <div className="flex gap-2">
                                  <Input
                                      id="addFriendCode"
                                      placeholder="Enter 10-digit friend code"
                                      value={friendCodeToAdd}
                                       onChange={(e) => setFriendCodeToAdd(e.target.value.trim())}
                                       maxLength={10}
                                   />
                                  <Button onClick={handleAddFriend} disabled={!friendCodeToAdd || friendCodeToAdd.length !== 10}>
                                       <UserPlus className="mr-2 h-4 w-4" /> Add Friend
                                   </Button>
                              </div>
                           </div>
                            <Separator />
                            <div>
                                <h3 className="text-md font-semibold mb-2">Sent Requests</h3>
                                {outgoingRequestsLoading ? <p>Loading sent requests...</p> :
                                 outgoingRequests.filter(req => req.status === 'pending').length === 0 ? <p className="text-sm text-muted-foreground">No pending sent requests.</p> :
                                 <ul className="space-y-2">
                                     {outgoingRequests.filter(req => req.status === 'pending').map(req => (
                                         <li key={req.id} className="text-sm text-muted-foreground">
                                             Request sent to code: {req.recipientFriendCode}
                                         </li>
                                     ))}
                                 </ul>
                                }
                            </div>
                       </CardContent>
                   </Card>
                </TabsContent>

                <TabsContent value="requests">
                   <Card>
                       <CardHeader>
                           <CardTitle>Friend Requests</CardTitle>
                           <CardDescription>Manage incoming friend requests.</CardDescription>
                       </CardHeader>
                       <CardContent>
                            {incomingRequestsLoading ? (
                                <p>Loading requests...</p>
                            ) : incomingRequests.filter(req => req.status === 'pending').length === 0 ? (
                                <div className="text-center text-muted-foreground py-10">
                                    <p>No pending friend requests.</p>
                                </div>
                            ) : (
                                <ul className="space-y-3">
                                    {incomingRequests.filter(req => req.status === 'pending').map(request => (
                                        <li key={request.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
                                           <p className="font-medium">Request from: {request.requesterFriendCode || "Unknown User"}</p>
                                           <div className="flex gap-2">
                                               <Button size="sm" variant="outline" onClick={() => handleFriendRequest(request, 'accept')}>
                                                   <Check className="mr-1 h-4 w-4 text-green-500" /> Accept
                                               </Button>
                                               <Button size="sm" variant="outline" onClick={() => handleFriendRequest(request, 'reject')}>
                                                   <X className="mr-1 h-4 w-4 text-red-500" /> Reject
                                               </Button>
                                           </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                       </CardContent>
                   </Card>
                </TabsContent>
           </Tabs>
         </div>
       )}
     </AppLayout>
   );
 }
