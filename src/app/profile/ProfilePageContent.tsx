// app/profile/ProfilePageContent.tsx

'use client';

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { Checkbox } from '@/components/ui/checkbox';
import { useFirestoreDocument } from '@/hooks/useFirestoreDocument';
import { UserSchema, type User as UserType, ProfilePreferencesSchema } from '@/lib/firebaseTypes';
import type { ProfilePreferences } from '@/lib/firebaseTypes'; // Import ProfilePreferences explicitly
import { sendPasswordResetEmail, AuthError, getAuth } from 'firebase/auth'; // Import getAuth
import { getFirebase } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { updateProfile as updateAuthProfile } from 'firebase/auth'; // Import for updating auth profile
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter, useSearchParams } from 'next/navigation';
import { ThemeToggle } from '@/components/ThemeToggle'; // Import ThemeToggle
import { UserCog } from 'lucide-react';

const UserProfileFormSchema = ProfilePreferencesSchema.extend({
  // Add new fields for checkbox preferences
  allowStatsVisibility: z.boolean().default(true),
  allowHistoryVisibility: z.boolean().default(true),
});

type UserProfileFormValues = z.infer<typeof UserProfileFormSchema>;

export default function ProfilePageContent() {
  const { user, loading: authLoading } = useAuth();
  const { firestore, auth } = getFirebase(); // Added auth
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const userIdFromUrl = searchParams.get('id');
  const router = useRouter();

  // Determine if the profile being viewed is the logged-in user's profile
  const isOwnProfile = !userIdFromUrl || userIdFromUrl === user?.uid;

  const targetUserId = userIdFromUrl && user?.uid === userIdFromUrl ? user?.uid : undefined; // Only fetch if viewing own profile

  const { data: userData, loading: userDocumentLoading, error: userDocumentError } = useFirestoreDocument<UserType>(
    'users',
    ownProfileDocId,
    UserSchema,
  );

  // Determine if we are viewing another user's profile
  const isViewingOtherUserProfile = !!userIdFromUrl && !!user && userIdFromUrl !== user.uid;
  const otherUserDocIdToFetch = isViewingOtherUserProfile ? userIdFromUrl : undefined;
  
  const { data: otherUserData, loading: otherUserLoading, error: otherUserError } = useFirestoreDocument<UserType>(
      'users',
      otherUserDocIdToFetch,
      UserSchema
  );


  const form = useForm<UserProfileFormValues>({
    resolver: zodResolver(UserProfileFormSchema),
    defaultValues: {
      displayName: '',
      avatar: '',
      allowStatsVisibility: true, // Default to true
      allowHistoryVisibility: true, // Default to true
    },
  });

  const [currentAvatarPreview, setCurrentAvatarPreview] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (isEditingOwnProfile && userData) {
      const resetValues: UserProfileFormValues = {
        displayName:
          userData.profilePreferences?.displayName ||
          userData.username ||
          '',
        avatar: userData.profilePreferences?.avatar || '',
        allowStatsVisibility:
          userData.profilePreferences?.allowStatsVisibility ?? true,
        allowHistoryVisibility:
          userData.profilePreferences?.allowHistoryVisibility ?? true,
      };
  
      form.reset(resetValues);
      setCurrentAvatarPreview(resetValues.avatar || undefined);
    }
  }, [userData, form, isEditingOwnProfile]);
    
  const onSubmit = async (values: UserProfileFormValues) => {
    if (!user || !firestore || !auth.currentUser) { 
      toast({ title: 'Error', description: 'You must be logged in to update your profile.', variant: 'destructive' });
      return;
    }

    try {
      const userDocRef = doc(firestore, 'users', user.uid);
      const dataToUpdate: ProfilePreferences = {
        displayName: values.displayName,
        avatar: values.avatar || '', 
        allowStatsVisibility: values.allowStatsVisibility,
        allowHistoryVisibility: values.allowHistoryVisibility,
      };
      await updateDoc(userDocRef, {
        profilePreferences: dataToUpdate,
        ...(userData?.username !== values.displayName && { username: values.displayName }),
      });

      await updateAuthProfile(auth.currentUser, {
        displayName: values.displayName,
        photoURL: values.avatar || '',
      });
      
      toast({ title: 'Profile Updated', description: 'Your preferences have been saved.' });
      setCurrentAvatarPreview(dataToUpdate.avatar || undefined);
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({ title: 'Update Failed', description: 'Could not save your preferences.', variant: 'destructive' });
    }
  };

  const handlePasswordReset = async () => {
    if (!user || !user.email) {
      toast({
        title: 'Error',
        description: 'No user logged in or email not available.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await sendPasswordResetEmail(auth, user.email);
      toast({ title: 'Password Reset Email Sent', description: 'Please check your inbox.' });
    } catch (err) {
      const firebaseError = err as AuthError; 
      toast({ title: 'Error', description: `Error sending password reset email: ${firebaseError.message}`, variant: 'destructive' });
    }
  };

  const getInitials = () => {
    const name = form.watch('displayName') || userData?.username || user?.email;
    if (name) return name.charAt(0).toUpperCase();
    return 'P'; 
  };

  const handleAvatarUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newAvatarUrl = e.target.value;
    form.setValue('avatar', newAvatarUrl, { shouldValidate: true });
    setCurrentAvatarPreview(newAvatarUrl || undefined);
  };
  
  const isLoading = authLoading || (isEditingOwnProfile && userDocumentLoading) || (isViewingOtherUserProfile && otherUserLoading);

  // Skeleton for own profile edit page
  if (isLoading && isEditingOwnProfile) { 
 return (
      <AppLayout>
        <div className="container mx-auto p-4 md:p-8">
          <Skeleton className="h-10 w-1/3 mb-8" />
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <Skeleton className="h-8 w-1/2 mb-2" />
              <Skeleton className="h-4 w-3/4" />
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="flex flex-col items-center space-y-4 sm:flex-row sm:space-y-0 sm:space-x-6">
                <Skeleton className="h-24 w-24 rounded-full" />
                <div className="space-y-2 flex-1 w-full">
                   <Skeleton className="h-5 w-1/4" />
                   <Skeleton className="h-10 w-full" />
                </div>
              </div>
              <div className="space-y-2">
                <Skeleton className="h-5 w-1/4" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-5 w-1/4" />
                <Skeleton className="h-10 w-full" />
              </div>
            </CardContent>
            <CardFooter>
              <Skeleton className="h-10 w-24" />
            </CardFooter>
          </Card>
        </div>
      </AppLayout>
    );
  }

  // Prompt to login if trying to access own profile settings and not logged in
 if (!user && !authLoading && (!userIdFromUrl || (userIdFromUrl && userIdFromUrl === user?.uid))) {
    return (
      <AppLayout>
        <div className="container mx-auto p-4 md:p-8 flex flex-col items-center justify-center text-center min-h-[calc(100vh-10rem)]">
          <UserCog className="h-16 w-16 text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-3">Profile Settings</h1>
          <p className="text-muted-foreground mb-6 max-w-md">
            Please log in to manage your profile settings.
          </p>
          <Button onClick={() => router.push('/login')}>Login</Button>
        </div>
      </AppLayout>
    );
  }

  // Error for own profile document
  if (userDocumentError && isEditingOwnProfile) { 
     return (
      <AppLayout>
        <div className="container mx-auto p-4 md:p-8">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
                <CardTitle>Error</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-destructive">Error loading your profile data: {userDocumentError.message}</p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  // Displaying another user's profile
  if (isViewingOtherUserProfile) {
    const otherUserNameToDisplay = otherUserData?.profilePreferences?.displayName || otherUserData?.username || 'User';

    if (otherUserLoading) {
      return (
        <AppLayout>
          <div className="container mx-auto p-4 md:p-8">
            <Skeleton className="h-10 w-1/3 mb-8" />
            <Card className="max-w-2xl mx-auto">
              <CardHeader>
                <Skeleton className="h-8 w-1/2 mb-2" />
                <Skeleton className="h-4 w-3/4" />
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          </div>
        </AppLayout>
      );
    }

    if (otherUserError) {
      return (
        <AppLayout>
          <div className="container mx-auto p-4 md:p-8">
            <Card className="max-w-2xl mx-auto">
              <CardHeader>
                <CardTitle>Error</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-destructive">Error loading user data: {otherUserError.message}</p>
              </CardContent>
            </Card>
          </div>
        </AppLayout>
      );
    }
    
    if (!otherUserData) {
        return (
            <AppLayout>
                <div className="container mx-auto p-4 md:p-8">
                <Card className="max-w-2xl mx-auto">
                    <CardHeader><CardTitle>User Not Found</CardTitle></CardHeader>
                    <CardContent><p>The requested user profile could not be found.</p></CardContent>
                </Card>
                </div>
            </AppLayout>
        );
    }


    return (
      <AppLayout>
        <div className="container mx-auto p-4 md:p-8">
          <h1 className="text-3xl font-bold text-foreground mb-8">{`Viewing ${otherUserNameToDisplay}'s Profile`}</h1>
          <div className="grid gap-6 md:grid-cols-2 max-w-2xl mx-auto">
            {otherUserData?.profilePreferences?.allowStatsVisibility && (
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle>Statistics</CardTitle>
                  <CardDescription>View game statistics.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full" onClick={() => router.push(`/stats?id=${userIdFromUrl}`)}>
                    View Statistics
                  </Button>
                </CardContent>
              </Card>
            )}
            {otherUserData?.profilePreferences?.allowHistoryVisibility && (
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle>Game History</CardTitle>
                  <CardDescription>View past games played.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full" onClick={() => router.push(`/history?id=${userIdFromUrl}`)}>
                    View Game History
                  </Button>
                </CardContent>
              </Card>
            )}
            {!otherUserData?.profilePreferences?.allowStatsVisibility && !otherUserData?.profilePreferences?.allowHistoryVisibility && (
              <Card className="shadow-lg md:col-span-2">
                <CardHeader>
                    <CardTitle>Content Restricted</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">This user has chosen to keep their statistics and game history private.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </AppLayout>
    );
  }
  
  // Default to showing own profile edit form if logged in and not viewing other
  if (isEditingOwnProfile && userData) {
    return (
      <AppLayout>
        <div className="container mx-auto p-4 md:p-8">
          <h1 className="text-3xl font-bold text-foreground mb-8">Profile Settings</h1>
          <Card className="max-w-2xl mx-auto shadow-lg">
            <CardHeader>
              <CardTitle>Edit Your Profile</CardTitle>
              <CardDescription>Update your display name and avatar.</CardDescription>
            </CardHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)}>
                <CardContent className="space-y-6 pt-6">
                  <div className="flex flex-col items-center space-y-4 sm:flex-row sm:space-y-0 sm:space-x-6">
                    <Avatar className="h-24 w-24 text-3xl">
                      <AvatarImage src={currentAvatarPreview || undefined} alt={form.watch('displayName') || userData?.username || 'User'} data-ai-hint="profile avatar"/>
                      <AvatarFallback>{getInitials()}</AvatarFallback>
                    </Avatar>
                    <div className="w-full flex-1">
                      <FormField
                        control={form.control}
                        name="avatar"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Avatar URL</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="https://example.com/avatar.png"
                                {...field}
                                value={field.value || ''} 
                                onChange={handleAvatarUrlChange}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                  <FormField
                    control={form.control}
                    name="displayName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Display Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Your display name" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="allowStatsVisibility"
                    render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow">
                    <FormControl>
                    <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className="mt-1"
                    data-ai-hint="checkbox to allow stats visibility" />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                    <FormLabel>Allow others to see my statistics</FormLabel>
                    </div>
                    <FormMessage />
                    </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="allowHistoryVisibility"
                    render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow">
                    <FormControl>
                    <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className="mt-1"
                    data-ai-hint="checkbox to allow game history visibility" />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                    <FormLabel>Allow others to see my game history</FormLabel>
                    </div>
                    <FormMessage />
                    </FormItem>
                    )}
                  />
                   <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" value={user?.email || 'No email associated'} readOnly disabled className="bg-muted cursor-not-allowed" />
                      <Button
                        type="button" 
                        onClick={handlePasswordReset}
                        className="mt-2 w-full"
                      >Reset Password</Button>
                   </div>
                   <div className="space-y-2">
                      <Label htmlFor="friendCode">Friend Code</Label>
                      <Input id="friendCode" value={userData?.userFriendCode || 'N/A'} readOnly disabled className="bg-muted cursor-not-allowed" />
                   </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? 'Saving...' : 'Save Preferences'}
                  </Button>
                </CardFooter>
              </form>
            </Form>
          </Card>
        </div>
      </AppLayout>
    );
  }
  
  // Fallback for states not explicitly handled (e.g., user is null, and not trying to view other's profile)
  // This might include cases where userIdFromUrl is not provided and user is not logged in.
  if (!user && !authLoading && !isViewingOtherUserProfile) {
    return (
        <AppLayout>
            <div className="container mx-auto p-4 md:p-8 flex flex-col items-center justify-center text-center min-h-[calc(100vh-10rem)]">
            <UserCog className="h-16 w-16 text-muted-foreground mb-4" />
            <h1 className="text-2xl font-bold text-foreground mb-3">Profile</h1>
            <p className="text-muted-foreground mb-6 max-w-md">
                Please log in to view or edit profiles.
            </p>
            <Button onClick={() => router.push('/login')}>Login</Button>
            </div>
        </AppLayout>
    );
  }


  // Default fallback if no other condition is met (should ideally not be reached if logic is exhaustive)
  return (
    <AppLayout>
      <div className="container mx-auto p-4 md:p-8">
        <h1 className="text-3xl font-bold text-foreground mb-8">Profile Settings</h1>
        <Card className="max-w-2xl mx-auto shadow-lg">
          <CardHeader>
            <CardTitle>Edit Your Profile</CardTitle>
            <CardDescription>Update your display name and avatar.</CardDescription>
          </CardHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <CardContent className="space-y-6 pt-6">
                <div className="flex flex-col items-center space-y-4 sm:flex-row sm:space-y-0 sm:space-x-6">
                  <Avatar className="h-24 w-24 text-3xl">
                    <AvatarImage src={currentAvatarPreview || undefined} alt={form.watch('displayName') || userData?.username || 'User'} data-ai-hint="profile avatar"/>
                    <AvatarFallback>{getInitials()}</AvatarFallback>
                  </Avatar>
                  <div className="w-full flex-1">
                    <FormField
                      control={form.control}
                      name="avatar"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Avatar URL</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="https://example.com/avatar.png"
                              {...field}
                              value={field.value || ''} 
                              onChange={handleAvatarUrlChange}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
                <FormField
                  control={form.control}
                  name="displayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Display Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Your display name" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Allow Stats Visibility Checkbox */}
                <FormField
 control={form.control}
 name="allowStatsVisibility"
 render={({ field }) => (
 <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow">
 <FormControl>
 <Checkbox
 checked={field.value}
 onCheckedChange={field.onChange}
 className="mt-1"
 data-ai-hint="checkbox to allow stats visibility" />
 </FormControl>
 <div className="space-y-1 leading-none">
 <FormLabel>Allow others to see my statistics</FormLabel>
 </div>
 <FormMessage />
 </FormItem>
 )}
                />

                {/* Allow History Visibility Checkbox */}
                <FormField
 control={form.control}
 name="allowHistoryVisibility"
 render={({ field }) => (
 <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow">
 <FormControl>
 <Checkbox
 checked={field.value}
 onCheckedChange={field.onChange}
 className="mt-1"
 data-ai-hint="checkbox to allow game history visibility" />
 </FormControl>
 <div className="space-y-1 leading-none">
 <FormLabel>Allow others to see my game history</FormLabel>
 </div>
 <FormMessage />
 </FormItem>
 )}
                />


                {/* Text label for Theme Toggle */}
                {/* Using Label for consistent styling with other labels */}
                <Label>Change Theme: </Label>
                <ThemeToggle />

                 <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" value={user?.email || 'No email associated'} readOnly disabled className="bg-muted cursor-not-allowed" />
                    <Button
                      type="button" // Use type="button" to prevent form submission
                      onClick={handlePasswordReset}
                      className="mt-2 w-full"
                    >Reset Password</Button>
                 </div>
                 <div className="space-y-2">
                    <Label htmlFor="friendCode">Friend Code</Label>
                    <Input id="friendCode" value={userData?.userFriendCode || 'N/A'} readOnly disabled className="bg-muted cursor-not-allowed" />
                 </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? 'Saving...' : 'Save Preferences'}
                </Button>
              </CardFooter>
            </form>
          </Form>
        </Card>
      </div>
    </AppLayout>
  );
}

