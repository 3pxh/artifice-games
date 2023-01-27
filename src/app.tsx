import { h, Fragment } from "preact";
import { useState } from "preact/hooks";
import { AuthContext, useAuth } from "./AuthProvider"
import { Auth } from "./Auth";
import { createGame, pingRoom } from "./actions";
import { GameNames } from "./gameTypes";
import { Game } from "./Game";

export function App() {
  const { user, login, logout } = useAuth();
  const [roomId, setRoomId] = useState<string | null>(null);

  const handleCreateGame = (gameName: GameNames) => {
    const id = createGame(gameName);
    if (!id) {
      console.error("Failed to create room.");
    } else {
      // Join the room!
      console.log("Created room", id);
      setRoomId(id);
      pingRoom(id);
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
      {!roomId && user && user.email // Not anon
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

      {roomId 
      ? <Game roomId={roomId} />
      : <></>}
    </AuthContext.Provider>
    </>
  )
}