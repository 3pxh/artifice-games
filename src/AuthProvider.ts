import { createContext } from 'preact'
import { useEffect, useState } from 'preact/hooks';
import { User, isSignInWithEmailLink, signInWithEmailLink, sendSignInLinkToEmail, signInAnonymously } from "@firebase/auth";
import { auth } from './Firebase'

export enum AuthType { "EmailLink", "Anonymous" }

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    auth.onAuthStateChanged(user => {
      if (user) {
        console.log("Got a user!", user)
        setUser(user);
      }
      else {
        // User is signed out.
      }
    })

    if (isSignInWithEmailLink(auth, window.location.href)) {
      let email = window.localStorage.getItem('emailForSignIn');
      if (!email) {
        email = window.prompt('Please provide your email for confirmation');
      }
      if (email) {
        signInWithEmailLink(auth, email, window.location.href)
        .then(() => {
          window.localStorage.removeItem('emailForSignIn');
        })
        .catch((error) => {
          console.error("Error signing in with email link", {error})
        });
      }
    }
  })

  const emailAuth = (email: string) => {
    console.log("starting firebase email auth");
    const actionCodeSettings = {
      url: location.hostname === "localhost" ? "http://localhost:3000" : "https://artifice.games",
      handleCodeInApp: true,
    };
    sendSignInLinkToEmail(auth, email, actionCodeSettings)
      .then(() => {
        window.localStorage.setItem('emailForSignIn', email);
        console.log("firebase auth link sent to email");
      })
      .catch((error) => {
        console.error("Email link auth error", {error})
      });
  }

  const anonAuth = () => {
    signInAnonymously(auth)
    .then(() => {
      
    })
    .catch((error) => {
        console.error("Error authenticating anonymously", {error})
    });
  }

  const login = (type: AuthType, email?: string) => {
    if (type === AuthType.Anonymous) {
      anonAuth();
    } else if (type === AuthType.EmailLink && email) {
      emailAuth(email);
    }
  };

  const logout = () => {
    setUser(null);
    auth.signOut();
  };

  return { user, login, logout };
};

export const AuthContext = createContext<{
  user: User | null;
  login:(t: AuthType, e?: string) => void,
  logout: () => void,
}>({
  user: null,
  login: () => {},
  logout: () => {},
});

