import { h, Fragment } from 'preact'
import { useContext } from 'preact/hooks'
import { Link } from 'preact-router/match';
import { AuthContext } from './AuthProvider'

export default function TopNav() {
  const authContext = useContext(AuthContext);
  const loggedInLinks = [
    { href: "/create", label: "Create / Join" },
    { href: "/games/active", label: "Active Games" },
    { href: "/games/past", label: "Past Games" },
  ];
  const loggedOutLinks = [
    { href: "/auth", label: "Log In" },
  ]
  const links = authContext.user ? loggedInLinks : loggedOutLinks;

  return <div class="TopNav">
    {links.map(link => <Link activeClassName="TopNav--active" href={link.href} key={link.label}>
      {link.label}
    </Link>)}

    {authContext.user && <>
      Welcome, {authContext.user.email || "anonymous"} 
      <button onClick={authContext.logout}>Log out</button>
    </>}
  </div>
}