'use client';

import { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  query,
  QueryConstraint,
  QuerySnapshot,
  FirestoreError,
  DocumentData,
} from 'firebase/firestore';
import { z, ZodError } from 'zod';
import { getFirebase } from '@/firebase';

type UseFirestoreCollectionResult<T> = {
  data: T[];
  loading: boolean;
  error: FirestoreError | ZodError | null;
};

export function useFirestoreCollection<T>(
  collectionPath: string,
  schema: z.ZodType<T>,
  constraints: QueryConstraint[] = []
): UseFirestoreCollectionResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | ZodError | null>(null);
  const { firestore } = getFirebase();

  useEffect(() => {
    const collectionRef = collection(firestore, collectionPath);
    const q = query(collectionRef, ...constraints);

    const unsubscribe = onSnapshot(
      q,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const items: T[] = [];
        let validationErrorOccurred = false;

        snapshot.forEach((doc) => {
          try {
            const validatedItem = schema.parse({ id: doc.id, ...doc.data() });
            items.push(validatedItem);
          } catch (validationError) {
            if (validationError instanceof ZodError) {
              console.error(`Zod validation error for doc ${doc.id}:`, validationError.errors);
              if (!validationErrorOccurred) {
                setError(validationError);
                validationErrorOccurred = true;
              }
            } else {
              console.error(`Unknown error validating document ${doc.id}:`, validationError);
              if (!validationErrorOccurred) {
                setError(new Error(`Data validation failed for doc ${doc.id}`) as any);
                validationErrorOccurred = true;
              }
            }
          }
        });

        if (validationErrorOccurred) {
          setData([]);
        } else {
          setData(items);
          setError(null);
        }

        setLoading(false);
      },
      (firestoreError: FirestoreError) => {
        console.error('Error fetching collection:', firestoreError);
        setError(firestoreError);
        setData([]);
        setLoading(false);
      }
    );

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firestore, collectionPath, schema, JSON.stringify(constraints)]);

  return { data, loading, error };
}
