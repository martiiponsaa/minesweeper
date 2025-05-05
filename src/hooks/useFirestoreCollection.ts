'use client';

import { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  QueryConstraint,
  QuerySnapshot,
  FirestoreError,
  Firestore,
  DocumentData,
} from 'firebase/firestore';
import { z, ZodSchema } from 'zod';
import { getFirebase } from '@/firebase'; // Ensure getFirebase is client-compatible

type UseFirestoreCollectionResult<T> = {
  data: T[];
  loading: boolean;
  error: FirestoreError | ZodSchema | null;
};

// Define valid query constraint types more explicitly if possible,
// or keep using QueryConstraint if flexible querying is needed.
export function useFirestoreCollection<T>(
  collectionPath: string,
  schema: z.ZodType<T>,
  constraints: QueryConstraint[] = []
): UseFirestoreCollectionResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | ZodSchema | null>(null);
  const { firestore } = getFirebase();

  useEffect(() => {
    const collectionRef = collection(firestore, collectionPath);
    // Apply constraints to the query
    const q = query(collectionRef, ...constraints);

    const unsubscribe = onSnapshot(
      q,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const items: T[] = [];
        let validationErrorOccurred = false;
        snapshot.forEach((doc) => {
          try {
            // Include document ID in the data object
             const validatedItem = schema.parse({ id: doc.id, ...doc.data() });
            items.push(validatedItem);
          } catch (validationError) {
            if (validationError instanceof z.ZodError) {
              console.error(`Zod validation error for doc ${doc.id}:`, validationError.errors);
               if (!validationErrorOccurred) { // Store only the first Zod error instance
                 setError(validationError);
                 validationErrorOccurred = true;
               }
            } else {
               console.error(`Error validating document ${doc.id}:`, validationError);
               if (!validationErrorOccurred) { // Store only the first generic error
                 setError(new Error(`Data validation failed for doc ${doc.id}`) as any);
                 validationErrorOccurred = true;
               }
            }
          }
        });

         // If a validation error occurred, set data to empty array
         if (validationErrorOccurred) {
           setData([]);
         } else {
           setData(items);
           setError(null); // Clear error if validation succeeds for all docs
         }

        setLoading(false);
      },
      (firestoreError: FirestoreError) => {
        console.error('Error fetching collection:', firestoreError);
        setError(firestoreError);
        setData([]); // Clear data on Firestore error
        setLoading(false);
      }
    );

    // Cleanup subscription on unmount
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firestore, collectionPath, schema, JSON.stringify(constraints)]); // Use JSON.stringify for constraints dependency

  return { data, loading, error };
}
