// Import the functions you need from the SDKs you need
import { initializeApp } from "@firebase/app";
import { getDatabase, connectDatabaseEmulator, ref, set, push } from "@firebase/database";
// import { getFunctions, connectFunctionsEmulator } from '@firebase/functions';
import { getAuth, setPersistence, browserLocalPersistence } from "@firebase/auth";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC9IlVuzQPTlQdiIjuAtl0bNfc1dRfRCrU",
  authDomain: "threepixelheart-f5674.firebaseapp.com",
  databaseURL: "https://threepixelheart-f5674-default-rtdb.firebaseio.com",
  projectId: "threepixelheart-f5674",
  storageBucket: "threepixelheart-f5674.appspot.com",
  messagingSenderId: "528049220137",
  appId: "1:528049220137:web:8e937543cfb87b72670a38"
};

// Initialize Firebase
export const firebase = initializeApp(firebaseConfig);
export const db = getDatabase(firebase);

if (location.hostname === "localhost") {
  // Point to the RTDB emulator running on localhost.
  connectDatabaseEmulator(db, "localhost", 9000);
} 

export const auth = getAuth();
setPersistence(auth, browserLocalPersistence)
  .then(() => { })
  .catch((error) => {
    const errorCode = error.code;
    const errorMessage = error.message;
    console.log("Error setting persistence", {errorCode, errorMessage})
  });

// export const functions = getFunctions(firebase);
// connectFunctionsEmulator(functions, "localhost", 5001);
// TODO: want to be able to fully emulate functions and rtdb locally.

export const message = (m: any) => {
  const k = push(ref(db, 'messages/')).key;
  set(ref(db, `messages/${k}`), m);
}
