import { h, Fragment } from "preact"
import { AuthContext, useAuth } from "./AuthProvider"
import { Auth } from "./Auth"
import { createGame, pingRoom } from "./actions";
import { GameNames } from "./gameTypes"

export function App() {
  const { user, login, logout } = useAuth();

  const handleCreateGame = (gameName: GameNames) => {
    const roomId = createGame(gameName);
    if (!roomId) {
      console.error("Failed to create room.");
    } else {
      // Join the room!
      console.log("Created room", roomId);
      pingRoom(roomId);
    }
  }

  return (
    <>
    <AuthContext.Provider value={{
      user,
      login,
      logout
    }}>
      <Auth />
      {user && user.email // Not anon
      ? <>
        <div>
          Create a game. 
          <button onClick={() => {handleCreateGame("farsketched")}}>Farsketched</button>
          <button onClick={() => {handleCreateGame("gisticle")}}>Gisticle</button>
          <button onClick={() => {handleCreateGame("tresmojis")}}>Tresmojis</button>
        </div>
      </>
      : <></>}

      {user 
      ? <>
        <div>
          Room code: <input  /> <button>Join</button>
        </div>
      </>
      : <></>}
    </AuthContext.Provider>
    </>
  )
}