import { h, Fragment } from "preact";
import { useContext } from "preact/hooks";
import { Link } from "preact-router/match";
import { AuthContext } from "../AuthProvider";

export default function Account() {
  const authContext = useContext(AuthContext);

  if (authContext.user) {
    return <div class="Account">
      <span>You're logged in as {authContext.user.email || "anonymous"}<br/>
      <button onClick={authContext.logout}>Log out</button></span><br/>
      <Link href="/support">
        Support Artifice / Manage Billing
      </Link>
    </div>
  } else {
    // We shouldn't get here...
    return <div class="Account">
      <Link href="/auth">
        Log In
      </Link>
    </div>
  }
}