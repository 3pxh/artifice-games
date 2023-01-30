import { h, Fragment } from "preact";
import { useEffect } from "preact/hooks";
import { useAuth, AuthContext } from "./AuthProvider";
import { Auth } from "./Auth";
import GameSelection from "./GameSelection";

export default function App() {
  const { user, login, logout } = useAuth();

  return <>
  <AuthContext.Provider value={{
      user,
      login,
      logout
    }}>
      <Auth />
      <GameSelection />
  </AuthContext.Provider>
  </>
}
