'use client';
 import AppLayout from '@/components/layout/AppLayout';
 import { useAuth } from '@/hooks/useAuth';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
 import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
 import { Separator } from '@/components/ui/separator';
 import { UserPlus, Check, X, Users, Eye, Hourglass, Trash2 } from 'lucide-react'; 
 import { useState, useEffect } from 'react';
 import { useRouter } from 'next/navigation';
 import { useFirestoreDocument } from '@/hooks/useFirestoreDocument';
 import { UserSchema, type User as UserType } from '@/lib/firebaseTypes';
 import { useFirestoreCollection } from '@/hooks/useFirestoreCollection';
 import { getFirebase } from '@/firebase';
 import { doc, updateDoc, query, where, getDocs, collection, writeBatch, serverTimestamp, setDoc, limit } from 'firebase/firestore';
 import { useToast } from '@/hooks/use-toast';
 import { FriendRequestSchema, type FriendRequest, FriendshipSchema, type Friendship } from '@/lib/firebaseTypes';
 import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'; 
 import { generateRandomFriendCode } from '@/lib/utils';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
 export default function FriendsPage() {
    const { user } = useAuth();
    const { firestore } = getFirebase();
    const { toast } = useToast();
    const router = useRouter();

    const [friendCodeToAdd, setFriendCodeToAdd] = useState('');
    const [processingRequestId, setProcessingRequestId] = useState<string | null>(null); 

    const { data: currentUserData, loading: currentUserLoading, error: currentUserError } = useFirestoreDocument<UserType>(
      'users',
      user?.uid,
      UserSchema
    );

    useEffect(() => {
        if (user && firestore && currentUserData && !currentUserLoading && !currentUserData.userFriendCode && !currentUserError) {
            const userDocRef = doc(firestore, 'users', user.uid);
            const newUserFriendCode = generateRandomFriendCode();
            updateDoc(userDocRef, { userFriendCode: newUserFriendCode })
                .then(() => {
                    toast({ title: "Friend Code Generated", description: "Your friend code is now available." });
                })
                .catch((error) => {
                    console.error("Error updating userFriendCode:", error);
                    toast({ title: "Error", description: "Could not generate your friend code. Please try reloading.", variant: "destructive" });
                });
        }
    }, [user, firestore, currentUserData, currentUserLoading, currentUserError, toast]);

    // 1. Fetch friendship links for the current user
    const { data: friendshipLinks, loading: friendshipLinksLoading } = useFirestoreCollection<Friendship>(
        'friendships',
        FriendshipSchema,
        user ? [where('users', 'array-contains', user.uid)] : [],
        !user
    );

    // 2. Extract friend UIDs from these links
    const [friendUIDs, setFriendUIDs] = useState<string[]>([]);
    useEffect(() => {
        if (friendshipLinks && user) {
            const uids = friendshipLinks
                .map(link => link.users.find(uid => uid !== user.uid))
                .filter((uid): uid is string => !!uid);
            setFriendUIDs(uids);
        } else {
            setFriendUIDs([]);
        }
    }, [friendshipLinks, user]);

    // 3. Fetch profiles of these friends
    const { data: friendsProfiles, loading: friendsProfilesLoading } = useFirestoreCollection<UserType>(
        'users',
        UserSchema,
        friendUIDs.length > 0 ? [where('id', 'in', friendUIDs)] : [],
        friendUIDs.length === 0
    );
    
    const { data: incomingRequests, loading: incomingRequestsLoading, refetch: refetchIncomingRequests } = useFirestoreCollection<FriendRequest>(
        'friendRequests',
        FriendRequestSchema,
        user ? [where('recipientId', '==', user.uid), where('status', '==', 'pending')] : [],
        !user
    );

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
                toast({ title: "Request Pending", description: "A friend request already exists with this user.", variant: "default" });
                setFriendCodeToAdd('');
                return;
            }

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
             // Check if already friends by querying the friendships collection
            const friendshipQuery = query(
                collection(firestore, 'friendships'),
                where('users', 'array-contains', user.uid)
            );
            const friendshipSnapshot = await getDocs(friendshipQuery);
            const isAlreadyFriends = friendshipSnapshot.docs.some(doc => (doc.data() as Friendship).users.includes(recipientUserData.id));

            if (isAlreadyFriends) {
                toast({ title: "Already Friends", description: "You are already friends with this user.", variant: "default" });
                setFriendCodeToAdd('');
                return;
            }


            const newRequestRef = doc(collection(firestore, 'friendRequests'));
            const newRequest: Omit<FriendRequest, 'id' | 'createdAt'> & { createdAt: any } = { // Allow any for serverTimestamp initially
                requesterId: user.uid,
                recipientId: recipientUserData.id,
                status: 'pending',
                requesterFriendCode: currentUserData.userFriendCode,
                recipientFriendCode: recipientUserData.userFriendCode,
                createdAt: serverTimestamp(), // Add serverTimestamp here
            };
            await setDoc(newRequestRef, newRequest);

            toast({ title: "Friend Request Sent", description: `Request sent to user with code ${friendCodeToAdd}.` });
            setFriendCodeToAdd('');
            refetchOutgoingRequests(); 
        } catch (error) {
            console.error("Error sending friend request:", error);
            toast({ title: "Error", description: "Could not send friend request.", variant: "destructive" });
        }
    };

    const deleteUser = async (friendId: string) => {
        if (!user || !firestore) {
            toast({ title: "Error", description: "Cannot delete friend. Ensure you are logged in.", variant: "destructive" });
            return;
        }

        try {
            // Find the friendship document
            const friendshipQuery = query(
                collection(firestore, 'friendships'),
                where('users', 'array-contains-any', [user.uid, friendId])
            );
            const snapshot = await getDocs(friendshipQuery);
            
            if (!snapshot.empty) {
                const batch = writeBatch(firestore);
                // Assuming there's only one friendship document between two users
                batch.delete(snapshot.docs[0].ref);
                await batch.commit();
                toast({ title: "Friend Removed", description: "The friendship has been removed." });
                // You might want to refetch the friends list here
            }
        } catch (error) {
            console.error("Error deleting friend:", error);
            toast({ title: "Error", description: "Could not remove friend.", variant: "destructive" });
        }
    };

    const handleFriendRequest = async (request: FriendRequest, action: 'accept' | 'reject') => {
        if (!user || !firestore || processingRequestId === request.id) {
            return;
        }
        setProcessingRequestId(request.id);

        const requestDocRef = doc(firestore, 'friendRequests', request.id);

        try {
            if (action === 'accept') {
                const batch = writeBatch(firestore);
                batch.delete(requestDocRef);

                // Create a new document in the 'friendships' collection
                const newFriendshipRef = doc(collection(firestore, 'friendships'));
                batch.set(newFriendshipRef, {
                    users: [request.requesterId, user.uid].sort(), 
                    createdAt: serverTimestamp()
                });
                
                await batch.commit();
                toast({ title: "Friend Added", description: "You are now friends!" });
            } else { 
                const batch = writeBatch(firestore);
                batch.delete(requestDocRef);
                await batch.commit();
                
                toast({ title: "Request Rejected", description: "Friend request has been rejected." });
            }
            refetchIncomingRequests(); 
        } catch (error) {
            console.error(`Error ${action}ing friend request:`, error);
            toast({ title: "Error", description: `Could not ${action} friend request.`, variant: "destructive" });
        } finally {
            setProcessingRequestId(null);
        }
    };

    const getInitials = (name?: string | null, email?: string | null) => {
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
                           {currentUserLoading || friendsProfilesLoading || friendshipLinksLoading ? (
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
                                   <div className="flex items-center gap-2">
                                        <Button variant="outline" size="sm" onClick={() => router.push(`/profile?id=${friend.id}`)} title="View Friend's Profile">
                                            <Eye className="mr-1 h-4 w-4" /> Profile
                                        </Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="destructive" size="sm" title="Delete Friend">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Are you sure you want to remove {friend.profilePreferences?.displayName || friend.username || 'this friend'}?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This action cannot be undone. This will permanently remove {friend.profilePreferences?.displayName || friend.username || 'this friend'} from your friends list.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => deleteUser(friend.id)}>Continue</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                   </div>
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
                                  value={currentUserLoading ? "Loading..." : (currentUserError ? "Error loading code" : (!currentUserData?.userFriendCode ? "Generating..." : currentUserData.userFriendCode))}
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
                                               <Button 
                                                    size="sm" 
                                                    variant="outline" 
                                                    onClick={() => handleFriendRequest(request, 'accept')}
                                                    disabled={processingRequestId === request.id}
                                                >
                                                    {processingRequestId === request.id ? (
                                                        <Hourglass className="mr-1 h-4 w-4 animate-spin" /> 
                                                    ) : (
                                                        <Check className="mr-1 h-4 w-4 text-green-500" />
                                                    )}
                                                    {processingRequestId === request.id ? 'Processing...' : 'Accept'}
                                                </Button>
                                               <Button 
                                                    size="sm" 
                                                    variant="outline" 
                                                    onClick={() => handleFriendRequest(request, 'reject')}
                                                    disabled={processingRequestId === request.id}
                                                >
                                                    {processingRequestId === request.id ? (
                                                        <Hourglass className="mr-1 h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <X className="mr-1 h-4 w-4 text-red-500" />
                                                    )}
                                                    {processingRequestId === request.id ? 'Processing...' : 'Reject'}
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
