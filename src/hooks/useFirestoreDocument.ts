'use client';

import { useState, useEffect } from 'react';
import { doc, onSnapshot, DocumentSnapshot, FirestoreError, Firestore, DocumentData } from 'firebase/firestore';
import { z, ZodSchema } from 'zod';
import { getFirebase } from '@/firebase'; // Ensure getFirebase is client-compatible

type UseFirestoreDocumentResult<T> = {
  data: T | null;
  loading: boolean;
  error: FirestoreError | ZodSchema | null;
};

export function useFirestoreDocument<T>(
  collectionPath: string,
  docId: string | undefined | null,
  schema: z.ZodType<T>
): UseFirestoreDocumentResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | ZodSchema | null>(null);
  const { firestore } = getFirebase();

  useEffect(() => {
    if (!docId) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    const docRef = doc(firestore, collectionPath, docId);

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot: DocumentSnapshot<DocumentData>) => {
        if (snapshot.exists()) {
          try {
            const validatedData = schema.parse({ id: snapshot.id, ...snapshot.data() });
            setData(validatedData);
            setError(null);
          } catch (validationError) {
             if (validationError instanceof z.ZodError) {
              console.error('Zod validation error:', validationError.errors);
              setError(validationError); // Store Zod error instance
            } else {
               console.error('Error validating document data:', validationError);
               setError(new Error('Data validation failed') as any); // Generic error for non-Zod issues
            }
            setData(null);
          }
        } else {
          setData(null); // Document doesn't exist
          setError(null);
        }
        setLoading(false);
      },
      (firestoreError: FirestoreError) => {
        console.error('Error fetching document:', firestoreError);
        setError(firestoreError);
        setData(null);
        setLoading(false);
      }
    );

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [firestore, collectionPath, docId, schema]); // Re-run effect if dependencies change

  return { data, loading, error };
}
