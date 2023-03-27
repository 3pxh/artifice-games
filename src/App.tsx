import { h, Fragment } from "preact";
import { useEffect } from "preact/hooks";
import { Router, Route, route } from "preact-router";
import { auth } from "./firebaseClient";
import { useAuth, AuthContext } from "./AuthProvider";
import { Routes } from "./router";
import Auth from "./Auth";
import TopNav from "./components/TopNav";
import GameSelection from "./pages/GameSelection";
import GameList from "./GameList";
import RoomById from "./RoomById";
import Support from "./Support";
import Intro, { INTRO_STATE_STORAGE_KEY } from "./pages/Intro";
import Account from "./pages/Account";
import Join from "./pages/Join";

const AuthRoute = () => {
  return <>
    <h2>🎨 Artifice 🤖 Games 🕹️</h2>
    <Auth />
  </>
}

const RootRedirect = () => {
  useEffect(() => {
    auth.onAuthStateChanged(() => {
      if (!auth.currentUser && window.localStorage.getItem(INTRO_STATE_STORAGE_KEY) !== "true") {
        route("/intro");
      } else if (!auth.currentUser && window.localStorage.getItem(INTRO_STATE_STORAGE_KEY) === "true") {
        route("/auth");
      } else if (window.location.pathname === "/auth") {
        window.history.back();
      } else {
        route("/create");
      }
    });
  });
  return null;
}

export default function App() {
  const authContext = useAuth();
  const handleRoute = (e: any) => {
    if (e.url !== "/auth" && e.url !== "/intro" && !auth.currentUser) {
      route("/");
    }
  };

  return <>
  <AuthContext.Provider value={authContext}>
    <TopNav /> 
    <div id="appbody">
      <Router onChange={handleRoute}>
        <Route path="/" component={RootRedirect} />
        <Route path="/intro" component={Intro} />
        <Route path="/auth" component={AuthRoute} />
        <Route path="/create" component={GameSelection} />
        <Route path="/join" component={Join} />
        <Route path="/games/:filter" component={GameList} />
        <Route path={Routes.room.pattern} component={RoomById} />
        <Route path="/support" component={Support} />
        <Route path="/account" component={Account} />
      </Router>
    </div>
  </AuthContext.Provider>
  </>
}
