import { h, Fragment } from 'preact'
import { useContext } from 'preact/hooks'
import { Link } from 'preact-router/match';
import { AuthContext } from './AuthProvider'

export default function TopNav() {
  const authContext = useContext(AuthContext);

  if (authContext.user) {
    return <div class="TopNav">
      <Link activeClassName="TopNav--active" href="/games">
        Games
      </Link>
      Welcome, {authContext.user.email || "anonymous"} 
      <button onClick={authContext.logout}>Log out</button>
    </div>
  } else {
    return <div class="TopNav">
      <Link activeClassName="TopNav--active" href="/auth">
        Home
      </Link>
    </div>
  }
}