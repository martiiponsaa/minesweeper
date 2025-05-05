'use client';

import { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  query,
  QueryConstraint,
  QuerySnapshot,
  FirestoreError,
  Firestore,
  DocumentData,
} from 'firebase/firestore';
import { z, ZodSchema } from 'zod';
import { getFirebase } from '@/firebase';

type UseFirestoreQueryResult<T> = {
  data: T[];
  loading: boolean;
  error: FirestoreError | ZodSchema | null;
};

export function useFirestoreQuery<T>(
  collectionPath: string,
  schema: z.ZodType<T>,
  constraints: QueryConstraint[] // Array of QueryConstraint from Firestore SDK
): UseFirestoreQueryResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | ZodSchema | null>(null);
  const { firestore } = getFirebase();

  useEffect(() => {
    // Create the base collection reference
    const collectionRef = collection(firestore, collectionPath);

    // Apply the dynamic constraints to build the query
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
             if (validationError instanceof z.ZodError) {
              console.error(`Zod validation error for doc ${doc.id} in ${collectionPath}:`, validationError.errors);
               if (!validationErrorOccurred) {
                 setError(validationError);
                 validationErrorOccurred = true;
               }
            } else {
               console.error(`Error validating document ${doc.id} in ${collectionPath}:`, validationError);
               if (!validationErrorOccurred) {
                 setError(new Error(`Data validation failed for doc ${doc.id}`) as any);
                 validationErrorOccurred = true;
               }
            }
          }
        });

         if (validationErrorOccurred) {
           setData([]); // Clear data if any validation failed
         } else {
           setData(items);
           setError(null); // Clear error on success
         }
        setLoading(false);
      },
      (firestoreError: FirestoreError) => {
        console.error(`Error fetching collection ${collectionPath}:`, firestoreError);
        setError(firestoreError);
        setData([]);
        setLoading(false);
      }
    );

    // Cleanup subscription on unmount
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firestore, collectionPath, schema, JSON.stringify(constraints)]); // Deep comparison might be needed for constraints array

  return { data, loading, error };
}
