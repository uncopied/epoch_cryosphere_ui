import { getAnalytics } from 'firebase/analytics';
import { initializeApp } from 'firebase/app';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  DocumentData,
  DocumentSnapshot,
  getDoc,
  getDocs,
  getFirestore,
  query,
  QueryDocumentSnapshot,
  QuerySnapshot,
  updateDoc,
  where,
} from 'firebase/firestore';
import { FirebaseCollections, FirebaseFields, Status } from '../utils';
import ChainService from './ChainService';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_ID + 'firebaseapp.com',
  projectId: process.env.REACT_APP_FIREBASE_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_ID + 'appspot.com',
  messagingSenderId: '389375659221',
  appId: '1:389375659221:web:35bee8184ceae82f32a65c',
};

export default class FirebaseService {
  currentAccountData = {};
  chainService = new ChainService();

  setup = async ({ account }: any): Promise<void> => {
    initializeApp(firebaseConfig);
    getAnalytics();
    if (account) {
      const currentAccount = await this.getDocument('accounts', account);
      this.currentAccountData = currentAccount.exists()
        ? currentAccount.data()
        : {};
    } else {
      this.currentAccountData = {};
    }
  };

  addDocument = async (
    collectionName: string,
    data: any
  ): Promise<DocumentSnapshot<any>> => {
    const firestore = getFirestore();
    const ref = collection(firestore, collectionName);
    const response = await addDoc(ref, data);
    return await getDoc(response);
  };

  getDocument = async (
    collectionName: string,
    docIndex: string
  ): Promise<DocumentSnapshot<DocumentData>> => {
    const firestore = getFirestore();
    const ref = doc(firestore, collectionName, docIndex);
    return await getDoc(ref);
  };

  updateDocument = async (
    collectionName: string,
    docIndex: string,
    data: any
  ): Promise<void> => {
    const firestore = getFirestore();
    const ref = doc(firestore, collectionName, docIndex);
    await updateDoc(ref, data);
  };

  deleteDocument = async (
    collectionName: string,
    docIndex: string
  ): Promise<void> => {
    const firestore = getFirestore();
    const ref = doc(firestore, collectionName, docIndex);
    return await deleteDoc(ref);
  };

  getDocuments = async (
    collectionName: string
  ): Promise<QuerySnapshot<DocumentData>> => {
    const firestore = getFirestore();
    const ref = collection(firestore, collectionName);
    return await getDocs(ref);
  };

  getContractForAsset = async (
    index: number
  ): Promise<QueryDocumentSnapshot<DocumentData> | null> => {
    const firestore = getFirestore();
    const ref = collection(firestore, FirebaseCollections.AssetSaleContracts);
    const contracts = query(
      ref,
      where(FirebaseFields.AssetIndex, '==', index),
      where(FirebaseFields.Status, '==', Status.Active)
    );
    const snapshot = await getDocs(contracts);
    if (snapshot.docs.length > 0 && snapshot.docs[0].exists()) {
      return snapshot.docs[0];
    } else {
      return null;
    }
  };

  getContractsForSeller = async (
    address: string
  ): Promise<QueryDocumentSnapshot<DocumentData>[]> => {
    const firestore = getFirestore();
    const ref = collection(firestore, FirebaseCollections.AssetSaleContracts);
    const filter = query(
      ref,
      where(FirebaseFields.Seller, '==', address),
      where(FirebaseFields.Status, '==', Status.Active),
      where(FirebaseFields.IsMain, '==', this.chainService.isMainNet)
    );
    const snapshot = await getDocs(filter);
    return snapshot.docs;
  };
}
