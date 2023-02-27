import { h, Fragment } from "preact";
import { useEffect } from "preact/hooks";
import { Router, Route, route } from "preact-router";
import { useAuth, AuthContext } from "./AuthProvider";
import { Routes } from "./router";
import Auth from "./Auth";
import TopNav from "./TopNav";
import GameSelection from "./GameSelection";
import GameList from "./GameList";
import RoomById from "./RoomById";

const AuthRoute = () => {
  const auth = useAuth();
  useEffect(() => {
    if (auth.user) {
      route("/games", true);
    }
  })

  return <>
    <h2>🎨 Artifice 🤖 Games 🕹️</h2>
    <Auth />
  </>
}

const Games = () => {
  return <>
    {/* Do we _just_ want to render GameSelection here, and have it render Room?
    Or would we like to put Room on App's state, and have a callback passed to GS?
    We shouldn't be rerendering App. So the current structure seems right, but
    the name "GameSelection" seems bad. TODO: Rename GameSelection.
    */}
    <div class="GameContainer">
      <GameSelection />
    </div>
  </>
}

const RootRedirect = () => {
  const auth = useAuth();

  useEffect(() => {
    if (!auth.user) {
      route("/auth", true);
    } else {
      route("/games", true);
    }
  })
  return null;
}

export default function App() {
  const auth = useAuth();
  const handleRoute = async (e: any) => {
    if (e.url !== "/auth" && auth.requiresAction()) {
      route("/auth", true);
    }
  };

  return <>
  <AuthContext.Provider value={auth}>
    <TopNav /> 
    <Router onChange={handleRoute}>
      <Route path="/" component={RootRedirect} />
      <Route path="/auth" component={AuthRoute} />
      <Route path="/create" component={Games} />
      <Route path="/games/:filter" component={GameList} />
      <Route path={Routes.room.pattern} component={RoomById} />
    </Router>
  </AuthContext.Provider>
  </>
}
