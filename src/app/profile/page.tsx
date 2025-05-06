'use client';

  import React, { useState, useEffect } from 'react';
  import { useForm } from 'react-hook-form';
  import { zodResolver } from '@hookform/resolvers/zod';
  import { z } from 'zod'; // Ensure z is imported
  import { useAuth } from '@/hooks/useAuth';
  import { useFirestoreDocument } from '@/hooks/useFirestoreDocument';
  import { getFirebase } from '@/firebase';
  import { doc, setDoc } from 'firebase/firestore';
  import { updateProfile as firebaseUpdateProfile, updatePassword as firebaseUpdatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
  import AppLayout from '@/components/layout/AppLayout';
  import { Button } from '@/components/ui/button';
  import { Input } from '@/components/ui/input';
  import { Label } from '@/components/ui/label';
  import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';  
  import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
  import { useToast } from '@/hooks/use-toast';
  import { ProfilePreferencesSchema, type ProfilePreferences, UserSchema, type User } from '@/lib/firebaseTypes';
  import { zodErrorHandler } from '@/lib/zodErrorHandler';
  import { Skeleton } from '@/components/ui/skeleton';
  import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
  import { AlertCircle, CheckCircle } from "lucide-react"
  import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar" // Import Avatar components
 import {
   AlertDialog,
   AlertDialogAction,
   AlertDialogCancel,
   AlertDialogContent,
   AlertDialogDescription,
   AlertDialogFooter,
   AlertDialogHeader,
   AlertDialogTitle,
   AlertDialogTrigger,
 } from "@/components/ui/alert-dialog"
import { FormDescription } from '@/components/ui/form';
 import { useRouter } from 'next/navigation';


 // Validation Schema for profile update
 const ProfileUpdateSchema = z.object({
   displayName: z.string().min(1, "Display name cannot be empty").optional(),
   avatar: z.string().url("Invalid avatar URL").optional().or(z.literal("")), // Allow empty string for clearing avatar
 });

 // Validation Schema for password update
 const PasswordUpdateSchema = z.object({
    currentPassword: z.string().min(6, "Current password is required"),
    newPassword: z.string().min(6, "New password must be at least 6 characters"),
    confirmPassword: z.string().min(6, "Please confirm your new password"),
 }).refine((data) => data.newPassword === data.confirmPassword, {
    message: "New passwords don't match",
    path: ["confirmPassword"], // path of error
 });

 type ProfileUpdateFormValues = z.infer<typeof ProfileUpdateSchema>;
 type PasswordUpdateFormValues = z.infer<typeof PasswordUpdateSchema>;

 export default function ProfilePage() {
   const { user, loading: authLoading } = useAuth(); // Get user and loading state
   const { firestore } = getFirebase();
   const router = useRouter();
   const { data: userData, loading: userLoading, error: userError } = useFirestoreDocument<User>(
     'users',
     user?.uid, // Pass uid directly
     UserSchema
   );
   const [isLoading, setIsLoading] = useState(false);
   const [isPasswordLoading, setIsPasswordLoading] = useState(false);
   const [pendingPasswordUpdate, setPendingPasswordUpdate] = useState<PasswordUpdateFormValues | null>(null);
   const { toast } = useToast();

   const profileForm = useForm<ProfileUpdateFormValues>({
     resolver: zodResolver(ProfileUpdateSchema),
     defaultValues: {
       displayName: '',
       avatar: '',
     },
   });

    const passwordForm = useForm<PasswordUpdateFormValues>({
      resolver: zodResolver(PasswordUpdateSchema),
      defaultValues: {
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      },
    });

     // Effect to reset form when userData or user changes
     useEffect(() => {
       // Prioritize userData if available and not loading
       if (userData?.profilePreferences && !userLoading) {
         profileForm.reset({
           displayName: userData.profilePreferences.displayName || user?.displayName || '',
           avatar: userData.profilePreferences.avatar || user?.photoURL || '',
         });
       } else if (user && !authLoading) { // Use auth data if firestore data is missing or still loading
         profileForm.reset({
           displayName: user.displayName || '',
           avatar: user.photoURL || '',
         });
       } else if (!user && !authLoading) { // Reset if user logs out
          profileForm.reset({ displayName: '', avatar: '' });
       }
     }, [userData, user, authLoading, userLoading, profileForm]);


     const onProfileSubmit = async (values: ProfileUpdateFormValues) => {
       if (!user) {
         toast({ title: 'Error', description: 'You must be logged in to update your profile.', variant: 'destructive' });
         return;
        }
       setIsLoading(true);

       const preferencesToUpdate: Partial<ProfilePreferences> = {}; // Use Partial<>
       if (values.displayName !== undefined) preferencesToUpdate.displayName = values.displayName;
        if (values.avatar !== undefined) preferencesToUpdate.avatar = values.avatar === '' ? undefined : values.avatar;


       try {
         const userDocRef = doc(firestore, 'users', user.uid);
         await setDoc(userDocRef, { profilePreferences: preferencesToUpdate }, { merge: true });

          // Also update Firebase Auth profile if values changed
         const authProfileUpdates: { displayName?: string | null; photoURL?: string | null } = {};
         if (values.displayName !== undefined && values.displayName !== user.displayName) {
            authProfileUpdates.displayName = values.displayName || null; // Use null to remove if empty string
          }
         if (values.avatar !== undefined && values.avatar !== user.photoURL) {
             authProfileUpdates.photoURL = values.avatar || null; // Use null to remove if empty string
          }

          if (Object.keys(authProfileUpdates).length > 0) {
             await firebaseUpdateProfile(user, authProfileUpdates);
          }


         toast({
           title: 'Profile Updated',
           description: 'Your profile preferences have been saved.',
           variant: 'default',
           action: <CheckCircle className="text-green-500"/>,
         });
       } catch (error: any) {
         console.error('Error updating profile:', error);
          const errorMessage = zodErrorHandler(error, "Profile update failed.");
         toast({
           title: 'Update Failed',
           description: errorMessage,
           variant: 'destructive',
           action: <AlertCircle className="text-red-500"/>,
         });
       } finally {
         setIsLoading(false);
       }
     };

      const handlePasswordUpdate = async (values: PasswordUpdateFormValues) => {
        if (!user || !user.email) {
            toast({ title: 'Error', description: 'You must be logged in to change your password.', variant: 'destructive' });
            return;
        }
         setIsPasswordLoading(true);
          setPendingPasswordUpdate(values); // Store the values for later

          const credential = EmailAuthProvider.credential(user.email, values.currentPassword);

          try {
             await reauthenticateWithCredential(user, credential);
             await updatePasswordInternal(values.newPassword);
          } catch (reauthError: any) {
             if (reauthError.code === 'auth/wrong-password') {
                  passwordForm.setError('currentPassword', { type: 'manual', message: 'Incorrect current password.' });
             } else if (reauthError.code === 'auth/too-many-requests') {
                 toast({ title: 'Too Many Attempts', description: 'Please try again later.', variant: 'destructive' });
              } else if (reauthError.code === 'auth/requires-recent-login') {
                 toast({ title: 'Re-authentication Required', description: 'Please log out and log back in to change your password.', variant: 'destructive' });
              } else {
                 console.error('Reauthentication error:', reauthError);
                 toast({ title: 'Error', description: 'Failed to re-authenticate. Please try again.', variant: 'destructive' });
             }
          } finally {
             setIsPasswordLoading(false);
              setPendingPasswordUpdate(null); // Clear pending update
          }
     };

     const updatePasswordInternal = async (newPassword: string) => {
         if (!user) return;
         try {
           await firebaseUpdatePassword(user, newPassword);
           toast({ title: 'Password Updated', description: 'Your password has been changed successfully.', variant: 'default' });
           passwordForm.reset();
         } catch (updateError: any) {
           console.error('Error updating password:', updateError);
            let message = 'Failed to update password. Please try again.';
            if (updateError.code === 'auth/weak-password') {
               message = 'New password is too weak. Please choose a stronger one.';
               passwordForm.setError('newPassword', { type: 'manual', message });
            }
           toast({ title: 'Update Failed', description: message, variant: 'destructive' });
         }
       };

    // Get first letter of email or display name for Avatar fallback
    const getInitials = () => {
      if (user?.displayName) return user.displayName.charAt(0).toUpperCase();
      if (user?.email) return user.email.charAt(0).toUpperCase();
      return '?';
    };

    // // Handle case where user is not logged in - Removed as AppLayout handles this
    // if (!authLoading && !user) {
    //   return (
    //      <AppLayout>
    //          <div className="container mx-auto p-4 md:p-8">
    //            <h1 className="text-3xl font-bold text-foreground mb-8">Profile & Settings</h1>
    //             <Alert variant="default" className="bg-card">
    //                <AlertCircle className="h-4 w-4" />
    //                <AlertTitle>Not Logged In</AlertTitle>
    //                <AlertDescription>
    //                  Please <Button variant="link" className="p-0 h-auto" onClick={() => router.push('/login')}>login</Button> to view and edit your profile.
    //                </AlertDescription>
    //              </Alert>
    //          </div>
    //       </AppLayout>
    //    )
    //  }


   return (
     <AppLayout>
       <div className="container mx-auto p-4 md:p-8">
         <h1 className="text-3xl font-bold text-foreground mb-8">Profile & Settings</h1>

          {/* Show skeleton only when auth OR firestore data is loading */}
          {(authLoading || userLoading) ? (
             <div className="space-y-6">
                <Skeleton className="h-10 w-1/3" />
                <Skeleton className="h-64 w-full rounded-lg" />
                <Skeleton className="h-64 w-full rounded-lg" />
             </div>
           ) : userError ? ( // Show error if Firestore loading failed
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error Loading Profile</AlertTitle>
                <AlertDescription>
                  There was an issue loading your profile data. Please try again later.
                </AlertDescription>
              </Alert>
           ) : ( // Render content if not loading and no error
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Profile Preferences Card */}
             <Card>
               <CardHeader>
                 <CardTitle>Profile Preferences</CardTitle>
                 <CardDescription>Update your display name and avatar.</CardDescription>
               </CardHeader>
               <Form {...profileForm}>
                 <form onSubmit={profileForm.handleSubmit(onProfileSubmit)}>
                   <CardContent className="space-y-4">
                     <FormField
                       control={profileForm.control}
                       name="displayName"
                       render={({ field }) => (
                         <FormItem>
                           <FormLabel>Display Name</FormLabel>
                           <FormControl>
                             <Input placeholder="Your display name" {...field} disabled={isLoading} />
                           </FormControl>
                           <FormMessage />
                         </FormItem>
                       )}
                     />
                      <FormField
                        control={profileForm.control}
                        name="avatar"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Avatar URL</FormLabel>
                            <FormControl>
                               <div className="flex items-center gap-2">
                                <Input
                                   placeholder="https://example.com/avatar.png"
                                   {...field}
                                   disabled={isLoading}
                                 />
                                {/* Show preview from field or user auth data */}
                                  <Avatar className="h-10 w-10">
                                     <AvatarImage src={field.value || user?.photoURL || undefined} alt="Avatar Preview" data-ai-hint="profile picture"/>
                                     <AvatarFallback>{getInitials()}</AvatarFallback>
                                  </Avatar>
                              </div>
                            </FormControl>
                             <FormDescription>Enter the URL of your desired avatar image.</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                   </CardContent>
                   <CardFooter>
                     <Button type="submit" disabled={isLoading || !profileForm.formState.isDirty}>
                       {isLoading ? 'Saving...' : 'Save Preferences'}
                     </Button>
                   </CardFooter>
                 </form>
               </Form>
             </Card>

             {/* Change Password Card */}
             <Card>
               <CardHeader>
                 <CardTitle>Change Password</CardTitle>
                 <CardDescription>Update your account password.</CardDescription>
               </CardHeader>
                <Form {...passwordForm}>
                 <form onSubmit={passwordForm.handleSubmit(handlePasswordUpdate)}>
                   <CardContent className="space-y-4">
                      <FormField
                        control={passwordForm.control}
                        name="currentPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Current Password</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="Enter your current password" {...field} disabled={isPasswordLoading} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                     <FormField
                       control={passwordForm.control}
                       name="newPassword"
                       render={({ field }) => (
                         <FormItem>
                           <FormLabel>New Password</FormLabel>
                           <FormControl>
                             <Input type="password" placeholder="Enter new password" {...field} disabled={isPasswordLoading} />
                           </FormControl>
                           <FormMessage />
                         </FormItem>
                       )}
                     />
                     <FormField
                       control={passwordForm.control}
                       name="confirmPassword"
                       render={({ field }) => (
                         <FormItem>
                           <FormLabel>Confirm New Password</FormLabel>
                           <FormControl>
                             <Input type="password" placeholder="Confirm new password" {...field} disabled={isPasswordLoading} />
                           </FormControl>
                           <FormMessage />
                         </FormItem>
                       )}
                     />
                   </CardContent>
                   <CardFooter>
                     <Button type="submit" disabled={isPasswordLoading}>
                       {isPasswordLoading ? 'Updating...' : 'Update Password'}
                     </Button>
                   </CardFooter>
                 </form>
               </Form>
             </Card>
           </div>
           )}
       </div>
     </AppLayout>
   );
 }
