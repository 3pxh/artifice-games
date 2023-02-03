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
  const [isPlayer, setIsPlayer] = useState<boolean>(true);
  const [isInputOnly, setIsInputOnly] = useState<boolean>(false);

  const handleCreateGame = (gameName: GameName) => {
    const id = createGame(gameName, isPlayer);
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

  const setPlayerType = (isPlayer: boolean, isInputOnly: boolean) => {
    setIsPlayer(isPlayer);
    setIsInputOnly(isInputOnly);
    console.log("Player", isPlayer, isInputOnly);
  }

  const handleJoinRoom = (roomCode: string) => {
    const code = roomCode.toUpperCase();
    console.log("Trying to join room", code);
    joinRoom(code, isPlayer, setRoom);
  }

  const Join = () => {
    return <div class="GameSelection-Join">
      {/* TODO: refactor so this only appears once.
      Really we want these radios rendered in the OPTIONS panel
      after choosing a particular game (or the Join option).
      */}
      <fieldset>
          <div>
            <input type="radio" id="shared" onChange={() => { setPlayerType(false, false); }} checked={!isPlayer} />
            <label for="shared">This is a shared display</label>
          </div>
          <div>
            <input type="radio" id="privateInput" onChange={() => { setPlayerType(true, true); }} checked={isPlayer && isInputOnly} />
            <label for="privateInput">I'm playing on this display, and I see a shared display</label>
          </div>
          <div>
            <input type="radio" id="privateFull" onChange={() => { setPlayerType(true, false); }} checked={isPlayer && !isInputOnly} />
            <label for="privateFull">This is the only screen I can see</label>
          </div>
        </fieldset>
      {/* Put the isPlayer logic here? That way when we send the join request, we can note it. */}
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
        <fieldset>
          <div>
            <input type="radio" id="shared" onChange={() => { setPlayerType(false, false); }} checked={!isPlayer} />
            <label for="shared">This is a shared display</label>
          </div>
          <div>
            <input type="radio" id="privateInput" onChange={() => { setPlayerType(true, true); }} checked={isPlayer && isInputOnly} />
            <label for="privateInput">I'm playing on this display, and I see a shared display</label>
          </div>
          <div>
            <input type="radio" id="privateFull" onChange={() => { setPlayerType(true, false); }} checked={isPlayer && !isInputOnly} />
            <label for="privateFull">This is the only screen I can see</label>
          </div>
        </fieldset>
        <button onClick={() => {handleCreateGame("farsketched")}}>Farsketched</button>
        <button onClick={() => {handleCreateGame("gisticle")}}>Gisticle</button>
        <button onClick={() => {handleCreateGame("tresmojis")}}>Tresmojis</button>
      </div>
      <Join />
    </>
    }
  } else {
    return <Room room={{
      ...room,
      isPlayer: isPlayer,
      isInputOnly: isInputOnly,
    }} />
  }
}