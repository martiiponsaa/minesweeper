
'use client';

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { useFirestoreDocument } from '@/hooks/useFirestoreDocument';
import { UserSchema, type User as UserType, ProfilePreferencesSchema, type ProfilePreferences } from '@/lib/firebaseTypes';
import { getFirebase } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { UserCog } from 'lucide-react';

const UserProfileFormSchema = ProfilePreferencesSchema; 

type UserProfileFormValues = z.infer<typeof UserProfileFormSchema>;

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const { firestore } = getFirebase();
  const { toast } = useToast();
  const router = useRouter();

  const { data: userData, loading: userDocumentLoading, error: userDocumentError } = useFirestoreDocument<UserType>(
    'users',
    user?.uid,
    UserSchema
  );

  const form = useForm<UserProfileFormValues>({
    resolver: zodResolver(UserProfileFormSchema),
    defaultValues: {
      displayName: '',
      avatar: '',
    },
  });

  const [currentAvatarPreview, setCurrentAvatarPreview] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (userData?.profilePreferences) {
      form.reset({
        displayName: userData.profilePreferences.displayName || userData.username || '',
        avatar: userData.profilePreferences.avatar || '',
      });
      setCurrentAvatarPreview(userData.profilePreferences.avatar || undefined);
    } else if (userData) { // Handle case where profilePreferences might be undefined
      form.reset({
        displayName: userData.username || '',
        avatar: '',
      });
      setCurrentAvatarPreview(undefined);
    }
  }, [userData, form]);

  const onSubmit = async (values: UserProfileFormValues) => {
    if (!user || !firestore) {
      toast({ title: 'Error', description: 'You must be logged in to update your profile.', variant: 'destructive' });
      return;
    }

    try {
      const userDocRef = doc(firestore, 'users', user.uid);
      const dataToUpdate: ProfilePreferences = {
        displayName: values.displayName,
        avatar: values.avatar || '', // Ensure empty string if null/undefined
      };
      await updateDoc(userDocRef, {
        profilePreferences: dataToUpdate,
        // Conditionally update username if it's meant to be synced with displayName
        ...(userData?.username !== values.displayName && { username: values.displayName }),
      });
      toast({ title: 'Profile Updated', description: 'Your preferences have been saved.' });
      setCurrentAvatarPreview(dataToUpdate.avatar || undefined);
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({ title: 'Update Failed', description: 'Could not save your preferences.', variant: 'destructive' });
    }
  };

  const getInitials = () => {
    const name = form.watch('displayName') || userData?.username || user?.email;
    if (name) return name.charAt(0).toUpperCase();
    return 'P'; // Default fallback
  };

  const handleAvatarUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newAvatarUrl = e.target.value;
    form.setValue('avatar', newAvatarUrl, { shouldValidate: true });
    setCurrentAvatarPreview(newAvatarUrl || undefined);
  };
  
  const isLoading = authLoading || userDocumentLoading;

  if (isLoading) {
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

  if (!user && !authLoading) { 
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
  
  if (userDocumentError) {
     return (
      <AppLayout>
        <div className="container mx-auto p-4 md:p-8">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
                <CardTitle>Error</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-destructive">Error loading user data: {userDocumentError.message}</p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

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
                 <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" value={user?.email || 'No email associated'} readOnly disabled className="bg-muted cursor-not-allowed" />
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

