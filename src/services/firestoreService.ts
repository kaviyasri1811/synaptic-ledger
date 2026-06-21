import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  Timestamp,
  serverTimestamp,
  DocumentData,
  QueryConstraint
} from 'firebase/firestore';
import { db, auth } from '../firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const firestoreService = {
  async getCollection<T = DocumentData>(collectionPath: string, constraints: QueryConstraint[] = []) {
    try {
      const q = query(collection(db, collectionPath), ...constraints);
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, collectionPath);
    }
  },

  subscribeToCollection<T = DocumentData>(
    collectionPath: string, 
    constraints: QueryConstraint[], 
    callback: (data: T[]) => void
  ) {
    const q = query(collection(db, collectionPath), ...constraints);
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
      callback(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, collectionPath);
    });
  },

  async getDoc<T = DocumentData>(collectionPath: string, docId: string) {
    try {
      const docRef = doc(db, collectionPath, docId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as T;
      }
      return null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `${collectionPath}/${docId}`);
    }
  },

  async addDoc(collectionPath: string, data: any) {
    try {
      const docRef = await addDoc(collection(db, collectionPath), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, collectionPath);
    }
  },

  async updateDoc(collectionPath: string, docId: string, data: any) {
    try {
      const docRef = doc(db, collectionPath, docId);
      await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${collectionPath}/${docId}`);
    }
  },

  async deleteDoc(collectionPath: string, docId: string) {
    try {
      const docRef = doc(db, collectionPath, docId);
      await deleteDoc(docRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${collectionPath}/${docId}`);
    }
  }
};
