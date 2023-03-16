import { h, Fragment } from 'preact'
import { useContext } from 'preact/hooks'
import { Link } from 'preact-router/match';
import { AuthContext } from './AuthProvider';
import { Logo } from './logo';


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

  return <div className="TopNav">
    <div className="TopNav-container _container">

      <div className="TopNav-logo">
        <Logo />

        <span className="TopNav-logo-text">
          Artifice Games
        </span>
      </div>

      <nav>
        {links.map(link => 
          <Link className="TopNav-link" activeClassName="TopNav-link--active" href={link.href} key={link.label}>
            {link.label}
          </Link>
        )}

        {authContext.user && 
          <>
            <span className="TopNav-welcome">
              Welcome, {authContext.user.email || "anonymous"} 
            </span>
            
            <button className="TopNav-button" onClick={authContext.logout}>Log out</button>
          </>
        }
      </nav>
    </div>
  </div>
}