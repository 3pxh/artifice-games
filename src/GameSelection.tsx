import { h, Fragment } from "preact";
import { useEffect, useState, useContext } from "preact/hooks";
import { GameName } from "../functions/src/games/games";
import { AuthContext } from "./AuthProvider"
import { createGame, pingRoom, joinRoom, getRoom } from "./actions";
import { Room, RoomData } from "./Room";
import SubmittableInput from "./components/SubmittableInput";

export default function GameSelection() {
  const { user } = useContext(AuthContext);
  const [room, setRoom] = useState<RoomData | null>(null);

  const handleCreateGame = (gameName: GameName) => {
    const id = createGame(gameName);
    if (!id) {
      throw new Error(`Failed to create room for game: ${gameName}`);
    } else {
      console.log("Created room", id);
      // TODO: set up regular pings if the room is _inQueue
      // Should probably be done in Room.tsx though!
      pingRoom(id); 
      getRoom(id, setRoom);
    }
  }

  const handleJoinRoom = (roomCode: string) => {
    const code = roomCode.toUpperCase();
    console.log("Trying to join room", code);
    joinRoom(code, setRoom);
  }

  const Join = () => {
    return <div class="GameSelection-Join">
      <SubmittableInput label="Room code" onSubmit={handleJoinRoom} buttonText="Join" />
    </div>
  }

  if (!user) {
    throw new Error("Cannot render GameSelection without a user.")
  }

  if (!room) {
    if (user.isAnonymous) {
      return <Join />
    } else {
      return <>
      <div>
        Create a game. 
        <button onClick={() => {handleCreateGame("farsketched")}}>Farsketched</button>
        <button onClick={() => {handleCreateGame("gisticle")}}>Gisticle</button>
        <button onClick={() => {handleCreateGame("tresmojis")}}>Tresmojis</button>
      </div>
      <Join />
    </>
    }
  } else {
    return <Room room={room} />
  }
}