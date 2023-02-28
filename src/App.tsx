import { h, Fragment } from "preact";
import { useEffect, useState } from "preact/hooks";
import { Router, Route, route } from "preact-router";
import { auth } from "./firebaseClient";
import { useAuth, AuthContext } from "./AuthProvider";
import { Routes } from "./router";
import Auth from "./Auth";
import TopNav from "./TopNav";
import GameSelection from "./GameSelection";
import GameList from "./GameList";
import RoomById from "./RoomById";

const AuthRoute = () => {
  return <>
    <h2>🎨 Artifice 🤖 Games 🕹️</h2>
    <Auth />
  </>
}

const Games = () => {
  return <>
    <div class="GameContainer">
      <GameSelection />
    </div>
  </>
}

const RootRedirect = () => {
  useEffect(() => {
    auth.onAuthStateChanged(() => {
      if (!auth.currentUser) {
        route("/auth");
      } else if (window.location.pathname === "/auth") {
        window.history.back();
      } else {
        route("/games");
      }
    });
  });
  return null;
}

export default function App() {
  const authContext = useAuth();
  const handleRoute = (e: any) => {
    if (e.url !== "/auth" && !auth.currentUser) {
      route("/auth");
    }
  };
  useEffect(() => {
    auth.onAuthStateChanged(() => {
      if (!auth.currentUser) {
        route("/auth");
      } else if (window.location.pathname === "/auth") {
        window.history.back();
      } else if (window.location.pathname === "/") {
        route("/create");
      }
      // TODO: check if they need to verify email?
    });
  }, [])

  return <>
  <AuthContext.Provider value={authContext}>
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
