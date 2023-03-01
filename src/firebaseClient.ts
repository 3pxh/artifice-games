import { initializeApp } from "@firebase/app";
import { getDatabase, connectDatabaseEmulator } from "@firebase/database";
import { getStorage, connectStorageEmulator } from "@firebase/storage";
import { getFirestore, connectFirestoreEmulator, collection, doc, addDoc, query, where, getDocs } from "@firebase/firestore";
import { getAuth, setPersistence, browserLocalPersistence, connectAuthEmulator } from "@firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyC9IlVuzQPTlQdiIjuAtl0bNfc1dRfRCrU",
  authDomain: "threepixelheart-f5674.firebaseapp.com",
  databaseURL: "https://threepixelheart-f5674-default-rtdb.firebaseio.com",
  projectId: "threepixelheart-f5674",
  storageBucket: "threepixelheart-f5674.appspot.com",
  messagingSenderId: "528049220137",
  appId: "1:528049220137:web:8e937543cfb87b72670a38"
};

export const firebase = initializeApp(firebaseConfig);
export const db = getDatabase(firebase);
export const storage = getStorage();
export const auth = getAuth();
export const firestore = getFirestore(firebase);

// We check the auth.emulatorConfig because Vite's hot reload will
// try to connect the emulators out from under us, causing an error.
if (location.hostname === "localhost" && auth.emulatorConfig?.host !== "localhost") {
  console.log("START EMU!****")
  connectDatabaseEmulator(db, "localhost", 9000);
  connectStorageEmulator(storage, "localhost", 9199);
  connectAuthEmulator(auth, "http://localhost:9099");
  connectFirestoreEmulator(firestore, "localhost", 8080);
} 

setPersistence(auth, browserLocalPersistence)
  .then(() => { })
  .catch((error) => {
    const errorCode = error.code;
    const errorMessage = error.message;
    console.log("Error setting persistence", {errorCode, errorMessage})
  });
