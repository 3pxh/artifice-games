import { get, ref, onValue } from "@firebase/database";
import { h, Fragment } from "preact";
import { useState } from "preact/hooks";
import { db } from "./firebaseClient";
import { GameName } from "../functions/src/games/games";
import { AuthContext, useAuth } from "./AuthProvider"
import { Auth } from "./Auth";
import { createGame, pingRoom } from "./actions";
import { Room, RoomData } from "./Room";

export function App() {
  const { user, login, logout } = useAuth();
  const [room, setRoom] = useState<RoomData | null>(null);

  const handleCreateGame = (gameName: GameName) => {
    const id = createGame(gameName);
    if (!id) {
      console.error("Failed to create room.");
    } else {
      console.log("Created room", id);
      pingRoom(id); // TODO: set up regular pings if the room is _inQueue
      const roomRef = ref(db, `rooms/${id}`);
      const unsubscribe = onValue(roomRef, (v) => {
        const roomSnapshot = v.val() as RoomData;
        console.log("Got room data", roomSnapshot);
        const isInitialized = roomSnapshot._initialized;
        if (isInitialized) {
          setRoom({
            ...roomSnapshot,
            id: id, // This sits above the snapshot itself
          });
          // We NEED to clean this up. Keeping a full room sub alive is bad.
          unsubscribe();
        }
      });
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
      {!room && user && user.email // Not anon
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

      {room 
      ? <Room room={room} />
      : <></>}
    </AuthContext.Provider>
    </>
  )
}