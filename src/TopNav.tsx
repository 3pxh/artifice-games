import { h, Fragment } from 'preact'
import { useContext } from 'preact/hooks'
import { AuthContext } from './AuthProvider'

export default function TopNav() {
  const authContext = useContext(AuthContext);
  if (!authContext.user) {
    throw new Error("Trying to render TopNav without a user");
  }

  return (
    <div class="TopNav">
      Welcome, {authContext.user.email || "anonymous"} 
      <button onClick={authContext.logout}>Log out</button>
    </div>
  )
}