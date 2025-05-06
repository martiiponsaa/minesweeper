'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

// Ensure Firebase app is initialized only once
function initializeFirebaseApp(): FirebaseApp {
  if (getApps().length) {
    return getApp();
  }
  return initializeApp(firebaseConfig);
}

let authInstance: ReturnType<typeof getAuth> | null = null;
let firestoreInstance: ReturnType<typeof getFirestore> | null = null;
let emulatorsConnected = false;

export function getFirebase() {
  const firebaseApp = initializeFirebaseApp();

  if (!authInstance) {
    authInstance = getAuth(firebaseApp);
  }
  if (!firestoreInstance) {
    firestoreInstance = getFirestore(firebaseApp);
  }

  // Check if running in a browser environment and if emulators should be used
  // Connect emulators only once
  if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_USE_EMULATORS === 'true' && !emulatorsConnected) {
    const authEmulatorHost = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST || 'localhost';
    const authEmulatorPortString = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_PORT || '9099';
    const authEmulatorPort = parseInt(authEmulatorPortString, 10);

    const firestoreEmulatorHost = process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST || 'localhost';
    const firestoreEmulatorPortString = process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_PORT || '8080';
    const firestoreEmulatorPort = parseInt(firestoreEmulatorPortString, 10);

    try {
      console.log(`Attempting to connect to Firebase Auth emulator at http://${authEmulatorHost}:${authEmulatorPort}`);
      connectAuthEmulator(authInstance, `http://${authEmulatorHost}:${authEmulatorPort}`, { disableWarnings: true });
      console.log('Successfully configured Auth emulator connection.');
    } catch (error) {
      console.error('Failed to configure Auth emulator connection:', error);
    }

    try {
      console.log(`Attempting to connect to Firestore emulator at ${firestoreEmulatorHost}:${firestoreEmulatorPort}`);
      connectFirestoreEmulator(firestoreInstance, firestoreEmulatorHost, firestoreEmulatorPort, { disableWarnings: true });
      console.log('Successfully configured Firestore emulator connection.');
    } catch (error) {
      console.error('Failed to configure Firestore emulator connection:', error);
    }
    emulatorsConnected = true;
  } else if (typeof window !== 'undefined' && !emulatorsConnected && process.env.NEXT_PUBLIC_USE_EMULATORS !== 'true') {
    console.log('Not using emulators or emulators already configured. Connecting to live Firebase services if not in emulator mode.');
  } else if (typeof window !== 'undefined' && emulatorsConnected) {
    // console.log('Emulators already connected.');
  }


  return { firebaseApp, auth: authInstance, firestore: firestoreInstance };
}
