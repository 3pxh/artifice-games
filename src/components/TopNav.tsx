import { h, Fragment } from 'preact'
import { useContext } from 'preact/hooks'
import { Link } from 'preact-router/match';
import "./TopNav.css";
import { AuthContext } from '../AuthProvider'
import imageSrc from "../../assets/favicon.png";

export default function TopNav() {
  const authContext = useContext(AuthContext);

  if (authContext.user) {
    return <div class="TopNav">
      <div class="TopNav-Logo">
        <img src={imageSrc} alt="Artifice Games Logo" />
        <strong>Artifice Games</strong>
      </div>
      <nav>
        <Link activeClassName="TopNav--active" href="/create">
          Create
        </Link>
        <Link activeClassName="TopNav--active" href="/join">
          Join
        </Link>
        {/* 
        These were for when we wanted long-lived async games
        <Link activeClassName="TopNav--active" href="/games/active">
          Active
        </Link>
        <Link activeClassName="TopNav--active" href="/games/past">
          Past
        </Link> 
        */}
        <Link activeClassName="TopNav--active" href="/account">
          Account
        </Link>
      </nav>
    </div>
  } else {
    return <div class="TopNav">
      <div class="TopNav-Logo">
        <img src={imageSrc} alt="Artifice Games Logo" />
        <strong>Artifice Games</strong>
      </div>
      <nav>
        <Link activeClassName="TopNav--active" href="/auth">
          Log In
        </Link>
      </nav>
    </div>
  }
}