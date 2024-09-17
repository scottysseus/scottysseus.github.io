// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBxKcaSAGFhUUzppFhsmdS4Xr8sAqbjJAo",
  authDomain: "my-site-e1956.firebaseapp.com",
  projectId: "my-site-e1956",
  storageBucket: "my-site-e1956.appspot.com",
  messagingSenderId: "381069304406",
  appId: "1:381069304406:web:91eb6d64b715f906f511f7",
  measurementId: "G-FCHWNF7B5C",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);
