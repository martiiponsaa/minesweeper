'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, AuthError, updateProfile, signInAnonymously } from 'firebase/auth';
import { getFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { FcGoogle } from "react-icons/fc"; // Using react-icons for Google icon
import { User as LucideUser } from 'lucide-react'; // For anonymous icon
import { doc, setDoc } from 'firebase/firestore';

// Validation Schemas
const LoginSchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
});

const RegisterSchema = z.object({
  username: z.string().min(3, { message: 'Username must be at least 3 characters' }),
  email: z.string().email({ message: 'Invalid email address' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
});

type LoginFormValues = z.infer<typeof LoginSchema>;
type RegisterFormValues = z.infer<typeof RegisterSchema>;

export default function AuthForm() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const { auth, firestore } = getFirebase(); // Added firestore

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(LoginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(RegisterSchema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
    },
  });

  const handleAuthSuccess = (message: string) => {
    toast({ title: message });
    router.push('/dashboard');
  };

  const handleAuthError = (error: AuthError, context?: string) => {
    console.error(`Authentication error${context ? ` during ${context}` : ''}:`, error.code, error.message, error);
    let message = 'An unexpected error occurred. Please try again.';
    switch (error.code) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential': // Common for wrong password/email combination
        message = 'Invalid email or password.';
        loginForm.setError("email", { type: "manual", message: " " });
        loginForm.setError("password", { type: "manual", message: "Invalid email or password."});
        break;
      case 'auth/email-already-in-use':
        message = 'This email address is already in use.';
        registerForm.setError("email", { type: "manual", message });
        break;
      case 'auth/weak-password':
        message = 'Password should be at least 6 characters.';
        registerForm.setError("password", { type: "manual", message });
        break;
      case 'auth/popup-closed-by-user':
         message = 'Sign-in popup closed by user.';
         break;
       case 'auth/cancelled-popup-request':
         message = 'Sign-in cancelled. Another popup is already open.';
         break;
       case 'auth/popup-blocked':
          message = 'Popup blocked by browser. Please allow popups for this site.';
          break;
      case 'auth/too-many-requests':
          message = 'Too many attempts. Please try again later.';
          break;
      case 'auth/network-request-failed':
          message = 'Network error. Please check your internet connection and try again.';
          break;
      case 'auth/operation-not-allowed':
          message = 'This sign-in method is not enabled. Please contact support.';
          break;
      case 'auth/unauthorized-domain':
          message = 'This domain is not authorized for OAuth operations. Please check Firebase console.';
          break;
      default:
        // Keep the generic message for other errors
        break;
    }
    toast({
      title: 'Authentication Failed',
      description: message,
      variant: 'destructive',
    });
  };

  const onLoginSubmit = async (values: LoginFormValues) => {
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, values.email, values.password);
      handleAuthSuccess('Login Successful');
    } catch (error) {
      handleAuthError(error as AuthError, 'email/password login');
    } finally {
      setIsLoading(false);
    }
  };

  const onRegisterSubmit = async (values: RegisterFormValues) => {
     setIsLoading(true);
     try {
       const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
       
       // Update Firebase Auth profile
       await updateProfile(userCredential.user, { displayName: values.username });

       // Save initial user data to Firestore
       const userDocRef = doc(firestore, 'users', userCredential.user.uid);
       await setDoc(userDocRef, {
         id: userCredential.user.uid,
         username: values.username, // Store the chosen username
         email: userCredential.user.email, // Store email for reference
         profilePreferences: {
           displayName: values.username, // Set initial display name
           avatar: '', // Default avatar or leave empty
         },
         friendCodes: [], // Initialize empty array
         friendIds: [],   // Initialize empty array
       }, { merge: true }); // Merge to avoid overwriting if doc somehow exists

       handleAuthSuccess('Registration Successful');
     } catch (error) {
       handleAuthError(error as AuthError, 'email/password registration');
     } finally {
       setIsLoading(false);
     }
   };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Save/update user data to Firestore on Google sign-in
      const userDocRef = doc(firestore, 'users', user.uid);
      await setDoc(userDocRef, {
        id: user.uid,
        username: user.displayName || user.email?.split('@')[0] || `user_${user.uid.substring(0,5)}`, // Use display name, or part of email, or a default
        email: user.email,
        profilePreferences: {
          displayName: user.displayName || user.email?.split('@')[0] || `User ${user.uid.substring(0,5)}`,
          avatar: user.photoURL || '',
        },
        // Ensure these fields exist, even if empty, to match UserSchema
        friendCodes: [], 
        friendIds: [],
      }, { merge: true }); // Use merge to create or update user data

      handleAuthSuccess('Signed in with Google');
    } catch (error) {
      handleAuthError(error as AuthError, 'Google Sign-In');
    } finally {
      setIsLoading(false);
    }
  };

   const handleAnonymousSignIn = async () => {
      setIsLoading(true);
      // No Firebase sign-in for guest mode, directly navigate
      // No Firestore data creation for guest
      router.push('/dashboard'); 
      // We don't call handleAuthSuccess as there's no actual "auth" event
      toast({ title: "Entering as Guest", description: "Your progress will not be saved." });
      setIsLoading(false);
    };


  return (
    <div className="flex items-center justify-center min-h-screen bg-secondary">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-primary">MineVerse</CardTitle>
          <CardDescription>Enter the MineVerse</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>

            {/* Login Tab */}
            <TabsContent value="login">
              <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                  <FormField
                    control={loginForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input placeholder="you@example.com" {...field} disabled={isLoading} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={loginForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="••••••••" {...field} disabled={isLoading} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isLoading}>
                    {isLoading ? 'Logging in...' : 'Login'}
                  </Button>
                </form>
              </Form>
            </TabsContent>

            {/* Register Tab */}
            <TabsContent value="register">
              <Form {...registerForm}>
                <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
                 <FormField
                    control={registerForm.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <Input placeholder="Choose a username" {...field} disabled={isLoading} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={registerForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input placeholder="you@example.com" {...field} disabled={isLoading} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={registerForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="Create a password (min. 6 characters)" {...field} disabled={isLoading} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isLoading}>
                    {isLoading ? 'Registering...' : 'Register'}
                  </Button>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        </CardContent>
         <CardFooter className="flex flex-col space-y-4">
           <div className="relative w-full">
             <div className="absolute inset-0 flex items-center">
               <span className="w-full border-t" />
             </div>
             <div className="relative flex justify-center text-xs uppercase">
               <span className="bg-background px-2 text-muted-foreground">
                 Or continue with
               </span>
             </div>
           </div>
           <div className="grid grid-cols-2 gap-4 w-full">
              <Button variant="outline" onClick={handleGoogleSignIn} disabled={isLoading} className="w-full">
                 <FcGoogle className="mr-2 h-4 w-4" /> Google
              </Button>
               <Button variant="outline" onClick={handleAnonymousSignIn} disabled={isLoading} className="w-full">
                  <LucideUser className="mr-2 h-4 w-4" /> Guest
               </Button>
           </div>
         </CardFooter>
      </Card>
    </div>
  );
}
