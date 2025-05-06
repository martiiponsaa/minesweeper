'use client';

import { useState, useEffect } from 'react';
import {
  doc,
  onSnapshot,
  DocumentSnapshot,
  FirestoreError,
  DocumentData,
} from 'firebase/firestore';
import { z, ZodError } from 'zod'; // ✅ use ZodError, not ZodSchema
import { getFirebase } from '@/firebase';

type UseFirestoreDocumentResult<T> = {
  data: T | null;
  loading: boolean;
  error: FirestoreError | ZodError | null;
};

export function useFirestoreDocument<T>(
  collectionPath: string,
  docId: string | undefined | null,
  schema: z.ZodType<T>
): UseFirestoreDocumentResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | ZodError | null>(null);
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
            if (validationError instanceof ZodError) {
              console.error('Zod validation error:', validationError.errors);
              setError(validationError); // ✅ Correct type
            } else {
              console.error('Error validating document data:', validationError);
              setError(new Error('Data validation failed') as any); // Fallback generic error
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

    return () => unsubscribe();
  }, [firestore, collectionPath, docId, schema]);

  return { data, loading, error };
}
