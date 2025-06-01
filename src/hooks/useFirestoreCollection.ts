
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  onSnapshot,
  query,
  QueryConstraint,
  QuerySnapshot,
  FirestoreError,
  DocumentData,
  Unsubscribe,
  limit, // Added limit
  orderBy, // Added orderBy
  where, // Added where
} from 'firebase/firestore';
import type { Query } from 'firebase/firestore';
import { z, ZodError } from 'zod';
import { getFirebase } from '@/firebase';

type UseFirestoreCollectionResult<T> = {
  data: T[];
  loading: boolean;
  error: FirestoreError | ZodError | null;
  refetch: () => void;
};

export function useFirestoreCollection<T>(
  queryOrCollectionPath: string | Query<DocumentData, DocumentData> | null,
  schema: z.ZodType<T>,
  constraints: QueryConstraint[] = [],
  disabled: boolean = false // New parameter to disable fetching
): UseFirestoreCollectionResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(!disabled); // Only load if not disabled
  const [error, setError] = useState<FirestoreError | ZodError | null>(null);
  const { firestore } = getFirebase();
  const [refreshKey, setRefreshKey] = useState(0); // Key to trigger refetch

  const refetch = useCallback(() => {
    setRefreshKey(prevKey => prevKey + 1);
  }, []);

  useEffect(() => {
    if (disabled) {
      setData([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true); // Set loading true at the start of fetch/refetch

    let q: Query<DocumentData, DocumentData> | null;

    if (typeof queryOrCollectionPath === 'string') {
      const collectionRef = collection(firestore, queryOrCollectionPath);
      q = query(collectionRef, ...constraints);
    } else {
      q = queryOrCollectionPath;
    }

    if (!q) {
      // If query is null, we don't fetch data.
      setLoading(false);
      setError(null); // Or set a specific error if needed
      return; // Exit useEffect
    }

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
    // Added queryOrCollectionPath and constraints to dependencies. Stringifying constraints for deep comparison.
  }, [firestore, queryOrCollectionPath, schema, JSON.stringify(constraints), disabled, refreshKey]);

  return { data, loading, error, refetch };
}
