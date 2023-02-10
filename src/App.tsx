import { h, Fragment } from "preact";
import { useEffect } from "preact/hooks";
import { useAuth, AuthContext } from "./AuthProvider";
import Auth from "./Auth";
import TopNav from "./TopNav";
import GameSelection from "./GameSelection";

export default function App() {
  const auth = useAuth();

  return <>
  <AuthContext.Provider value={auth}>
      {auth.requiresAction() 
      ? <>
        <h1>🎨 Artifice 🤖 Games 🕹️</h1>
        <Auth />
      </>
      : <>
        <TopNav /> 
        {/* Do we _just_ want to render GameSelection here, and have it render Room?
        Or would we like to put Room on App's state, and have a callback passed to GS?
        We shouldn't be rerendering App. So the current structure seems right, but
        the name "GameSelection" seems bad. TODO: Rename GameSelection.
        */}
        <div class="GameContainer">
          <GameSelection />
        </div>
      </>}
  </AuthContext.Provider>
  </>
}
