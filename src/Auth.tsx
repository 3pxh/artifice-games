import { h, Fragment } from 'preact'
import { useContext, useState } from 'preact/hooks'
import { AuthContext, AuthType } from './AuthProvider'

export default function Auth() {
  const authContext = useContext(AuthContext);
  const [isWaiting, setIsWaiting] = useState(false);
  const [email, setEmail] = useState('');
  
  const emailAuth = () => {
    if (email) { 
      setIsWaiting(true);
      authContext.login(AuthType.EmailLink, email);
    }
  }

  const anonAuth = () => {
    setIsWaiting(true);
    authContext.login(AuthType.Anonymous);
  }

  return (
    <>
    {authContext.user 
        ? <>
          <p>Welcome, {authContext.user.email || "anonymous"}</p>
          <button onClick={authContext.logout}>Log out</button>
        </>
        : isWaiting 
          ? "Waiting..." 
          : <>
            <input type="text" onInput={(e) => { setEmail(e.currentTarget.value); }} />
            <button onClick={emailAuth}>
              Log in with email
            </button> 
            or 
            <button onClick={anonAuth}>
              Log in anonymously
            </button>
          </>
    }
    </>
  )
}