'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import {  getFirestore, connectFirestoreEmulator } from 'firebase/firestore'

// IMPORTANT: CODE GENERATED - DO NOT MODIFY THIS FUNCTION
export function getFirebase() {
  const firebaseApp = initializeApp(firebaseConfig);
  const firestore = getFirestore(firebaseApp);
  const firestoreHost = process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST!;
  connectFirestoreEmulator(firestore, firestoreHost, 443)

  const auth = getAuth(firebaseApp);
  const authHost = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST!;
  connectAuthEmulator(auth, `https://${authHost}:443`);

  return { firebaseApp, auth, firestore };
}
