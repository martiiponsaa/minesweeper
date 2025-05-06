// Replace with your actual Firebase project configuration
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyD7_ARr0jVqgnGvW5XJlzUhZmDxt1OGFXA',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'free-online-minesweeper.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'free-online-minesweeper', // Ensure this uses a generic placeholder
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'free-online-minesweeper.firebasestorage.app',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '80477956666',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:80477956666:web:935900daefcc2ef5bfa303',
};

