import { h, Fragment } from "preact";
import { useState, useContext } from "preact/hooks";
import { GameName, TimerOption } from "../functions/src/games/games";
import { AuthContext } from "./AuthProvider"
import { createGame, joinRoom, getRoom } from "./actions";
import { Room, RoomData } from "./Room";
import SubmittableInput from "./components/SubmittableInput";

export default function GameSelection() {
  const { user } = useContext(AuthContext);
  const [room, setRoom] = useState<RoomData | null>(null);
  type DisplayMode = "observe" | "input" | "full";
  const [display, setDisplay] = useState<DisplayMode>("full");
  const [timerMode, setTimerMode] = useState<TimerOption>("off");
  const [selectedGame, setSelectedGame] = useState<GameName | "_join" | null>(null);

  const handleCreateGame = (gameName: GameName) => {
    if (user && !user.isAnonymous) {
      const isPlayer = display !== "observe";
      const id = createGame({
        gameName, 
        isPlayer,
        user: user.uid,
        timer: timerMode,
      });
      if (!id) {
        throw new Error(`Failed to create room for game: ${gameName}`);
      } else {
        console.log("Created room", id);
        getRoom(id, setRoom);
      }
    } else {
      throw new Error("Cannot create a game as an anonymous user");
    }
  }

  const handleJoinRoom = (roomCode: string) => {
    const code = roomCode.toUpperCase();
    console.log("Trying to join room", code);
    joinRoom(code, display !== "observe", setRoom);
  }

  const DisplayOptions = () => {
    const setType = (t: DisplayMode) => {
      setDisplay(t);
    }
    const options:[DisplayMode, string][] = [
      ["observe", "Observing only / shared screen"],
      ["input", "Playing with a shared screen"],
      ["full", "Playing without a shared screen"],
    ];
    return <fieldset>
      <p>This display is for:</p>
      {options.map(([d,desc]) => {
        return <div key={d}>
        <input type="radio" id={d} onChange={() => { setType(d); }} checked={d === display} />
        <label for={d}>{desc}</label>
      </div>
      })}
    </fieldset>
  }
  const TimerOptions = () => {
    const options:TimerOption[] = ["off", "slow", "fast"];
    return <fieldset>
      <p>Timer:</p>
      {options.map(mode => {
        return <div key={mode}>
          <input type="radio" id={mode} onChange={() => { setTimerMode(mode); }} checked={timerMode === mode} />
          <label for={mode}>{mode}</label>
        </div>
      })}
    </fieldset>
  }

  const Join = () => {
    return <div class="GameSelection-Join">
      <DisplayOptions />
      <SubmittableInput label="Room code" onSubmit={handleJoinRoom} buttonText="Join" />
    </div>
  }

  if (!user) {
    throw new Error("Cannot render GameSelection without a user.")
  }

  // TODO: we should probably set Room on App, not inside GameSelection
  if (room) {
    return <Room room={{
      ...room,
      isPlayer: display !== "observe",
      isInputOnly: display === "input",
    }} />
  } else if (user.isAnonymous || selectedGame === "_join") {
    return <Join />
  } else if (selectedGame === null) {
    return <>
    <div>
      <h1>Create a game</h1>
      <button onClick={() => {setSelectedGame("farsketched")}}><h2>Farsketched</h2></button>
      <button onClick={() => {setSelectedGame("gisticle")}}><h2>Gisticle</h2></button>
      <button onClick={() => {setSelectedGame("tresmojis")}}><h2>Tresmojis</h2></button>
      <h1>Or,</h1>
      <button onClick={() => {setSelectedGame("_join")}}><h2>Join a game</h2></button>
    </div>
  </>
  } else {
    return <>
      <h1><button onClick={() => {setSelectedGame(null)}}><h2>←</h2></button>Create game: {selectedGame}</h1>
      <DisplayOptions />
      <TimerOptions />
      {/* Game options, e.g. model type */}
      <button onClick={() => {handleCreateGame(selectedGame)}}>Create room</button>
    </>
  }
}