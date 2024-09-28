import { h, Fragment } from "preact";
import { useContext, useState } from "preact/hooks";
import { AuthContext, AuthType } from "./AuthProvider";
import SubmittableInput from "./components/SubmittableInput";
import { INTRO_STATE_STORAGE_KEY } from "./pages/Intro";
import { Routes } from "./router";

enum LoginState {"Anon", "Email", "Choosing"};
// TODO: refactor this and AuthProvider so it's simpler.
// At time of writing, this component is rendered iff
// auth.requiresAction() returns true, and should provide
// flows to resolve any issues.
export default function Auth() {
  const authContext = useContext(AuthContext);
  const [loginState, setLoginState] = useState<LoginState>(LoginState.Choosing);
  
  const emailAuth = (email: string) => {
    setLoginState(LoginState.Email);
    authContext.login(AuthType.EmailLink, email);
  }

  const anonAuth = () => {
    setLoginState(LoginState.Anon);
    authContext.login(AuthType.Anonymous);
  }

  const EmailVerification = (props: {email: string}) => {
    const [isAwaitingVerification, setIsAwaitingVerification] = useState(false);
    
    if (isAwaitingVerification) {
      return <>Check {props.email} for account verification</>
    } else if (authContext.user && 
      !authContext.user.isAnonymous && 
      !authContext.user.emailVerified) {
        return <>
          Check {props.email} for a verification email.
          <button onClick={() => {
            setIsAwaitingVerification(true);
            authContext.verify();
          }}>Re-send link</button>
          <button onClick={() => {
            authContext.logout();
            setLoginState(LoginState.Choosing);
          }}>Use a different email</button>
        </>
    } else {
      return <></>
    }
  }

  if (!authContext.user) {
    if (loginState === LoginState.Choosing) {
      return <div class="Auth">
        <SubmittableInput
          label="Email:"
          buttonText="Log in/sign up"
          onSubmit={emailAuth}
          />
        {/* <h2>or</h2>
        <button onClick={anonAuth}>
          Log in anonymously
        </button> */}
        <a href="#" style="text-align:center; margin: 20px 0; font-size:14pt;" onClick={() => {
          window.localStorage.setItem(INTRO_STATE_STORAGE_KEY, "false");
          Routes.navigate(Routes.intro.href);
        }}>replay introduction</a>
      </div>
    } else if (loginState === LoginState.Anon) {
      return <>Logging in...</>
    } else if (loginState === LoginState.Email) {
      return <>Check your email for a link</>
    } else {
      return <>Unrecognized login state</>
    }
  } else if (authContext.user.isAnonymous) {
    return <>Logged in anonymously!</>
  } else if (!authContext.user.emailVerified) {
    return <>
      <EmailVerification email={authContext.user.email ?? ""} />
    </>
  } else {
    return <>
      You are logged in as {authContext.user.email}
    </>
  }
}