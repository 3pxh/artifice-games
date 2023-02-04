import { h, Fragment } from "preact";
import { useEffect } from "preact/hooks";
import { useAuth, AuthContext } from "./AuthProvider";
import Auth from "./Auth";
import TopNav from "./TopNav";
import GameSelection from "./GameSelection";

export default function App() {
  const { user, login, logout } = useAuth();

  return <>
  <AuthContext.Provider value={{
      user,
      login,
      logout
    }}>
      {!user 
      ? <Auth /> 
      : <>
        <TopNav /> 
        {/* Do we _just_ want to render GameSelection here, and have it render Room?
        Or would we like to put Room on App's state, and have a callback passed to GS?
        We shouldn't be rerendering App. So the current structure seems right, but
        the name "GameSelection" seems bad. TODO: Rename GameSelection.
        */}
        <GameSelection />
      </>}
  </AuthContext.Provider>
  </>
}
