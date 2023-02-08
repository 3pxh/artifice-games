import { initializeApp } from "@firebase/app";
import { getDatabase, connectDatabaseEmulator } from "@firebase/database";
import { getStorage, connectStorageEmulator } from "@firebase/storage";
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

if (location.hostname === "localhost") {
  // TODO: when vite hot reloads components we get
  // FIREBASE FATAL ERROR: Cannot call useEmulator() after instance has already been initialized. 
  try {
    connectDatabaseEmulator(db, "localhost", 9000);
    connectStorageEmulator(storage, "localhost", 9199);
    connectAuthEmulator(auth, "http://localhost:9099");
  } catch (e) {
    console.info("Error connecting emulators, was it from a vite reload?", e)
  }
} 

setPersistence(auth, browserLocalPersistence)
  .then(() => { })
  .catch((error) => {
    const errorCode = error.code;
    const errorMessage = error.message;
    console.log("Error setting persistence", {errorCode, errorMessage})
  });
