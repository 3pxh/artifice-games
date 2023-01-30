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
      console.error("Failed to create room.");
    } else {
      console.log("Created room", id);
      // TODO: set up regular pings if the room is _inQueue
      // Should probably be done in Room.tsx though!
      pingRoom(id); 
      getRoom(id, setRoom);
    }
  }

  const handleJoinRoom = (roomCode: string) => {
    console.log("Trying to join room", roomCode);
    joinRoom(roomCode, setRoom);
  }

  return (
    <>
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
          <SubmittableInput label="Room code" onSubmit={handleJoinRoom} buttonText="Join" />
        </div>
      </>
      : <></>}

      {room 
      ? <Room room={room} />
      : <></>}
    </>
  )
}