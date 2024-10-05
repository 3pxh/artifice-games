import { createContext } from "preact";
import { useEffect, useState } from "preact/hooks";
import { User, isSignInWithEmailLink, signInWithEmailLink, sendSignInLinkToEmail, 
  signInAnonymously, createUserWithEmailAndPassword, sendEmailVerification } from "@firebase/auth";
import { auth } from "./firebaseClient";

export enum AuthType { "EmailLink", "Anonymous" }

type Role = string | null;
type AuthInterface = {
  user: User | null
  login: (t: AuthType, e?: string) => void
  logout: () => void
  verify: () => void
  requiresAction: () => boolean
  role: () => Role,
  isPaid: () => boolean,
}

export const useAuth: () => AuthInterface = () => {
  const [user, setUser] = useState<User | null>(null);
  const [stripeRole, setStripeRole] = useState<Role>(null);

  useEffect(() => {
    auth.onAuthStateChanged(u => {
      if (u) {
        u.getIdTokenResult(true).then((idTokenResult) => {
          setStripeRole(idTokenResult.claims.stripeRole as Role);
        });
      }
      if (u && (!user || user.uid !== u.uid)) {
        setUser(u);
      }
      else {
        // User is signed out.
      }
    })

    if (isSignInWithEmailLink(auth, window.location.href)) {
      let email = window.localStorage.getItem("emailForSignIn");
      if (!email) {
        email = window.prompt("Please provide your email for confirmation");
      }
      if (email) {
        signInWithEmailLink(auth, email, window.location.href)
        .then(() => {
          // window.localStorage.removeItem("emailForSignIn");
        })
        .catch((error) => {
          console.error("Error signing in with email link", {error});
        });
      }
    }
  })

  const emailAuth = (email: string) => {
    const actionCodeSettings = {
      url: location.hostname === "localhost" ? "http://localhost:3000" : "https://artifice.games",
      handleCodeInApp: true,
    };
    window.localStorage.setItem("emailForSignIn", email);
    try {
    createUserWithEmailAndPassword(auth, email, crypto.randomUUID())
      .then((c) => {
        sendEmailVerification(c.user);
      })
      .catch(() => {
        sendSignInLinkToEmail(auth, email, actionCodeSettings)
          .then(() => {
            console.log("auth link sent to email");
          })
          .catch((error) => {
            console.error("Email link auth error", {error})
          });
      });
    } catch {
      sendSignInLinkToEmail(auth, email, actionCodeSettings)
          .then(() => {
            console.log("auth link sent to email");
          })
          .catch((error) => {
            console.error("Email link auth error", {error})
          });
    }
  }

  const anonAuth = () => {
    signInAnonymously(auth)
    .then(() => { })
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

  const verify = () => {
    if (user && !user.isAnonymous) {
      sendEmailVerification(user);
    } else {
      throw new Error("Trying to verify with nonexistant/anon user");
    }
  };

  const requiresAction = () => {
    if (!user) {
      return true;
    } else if (!user.isAnonymous && !user.emailVerified) {
      return true;
    } else {
      return false;
    }
  }
  
  const role = () => {
    return stripeRole;
  }

  const isPaid = () => {
    return stripeRole === "underwriter";
  }

  return { user, login, logout, verify, requiresAction, role, isPaid };
};

export const AuthContext = createContext<AuthInterface>({
  user: null,
  login: () => {},
  logout: () => {},
  verify: () => {},
  requiresAction: () => true,
  role: () => null,
  isPaid: () => false,
});

