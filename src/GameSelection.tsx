import { h, Fragment } from "preact";
import { useState, useContext } from "preact/hooks";
import { signal } from "@preact/signals";
import { GameName, TimerOption } from "../functions/src/games/games";
import { AuthContext } from "./AuthProvider"
import { createGame, joinRoom, getRoom } from "./actions";
import { Room, RoomData } from "./Room";
import SubmittableInput from "./components/SubmittableInput";

export default function GameSelection() {
  const { user } = useContext(AuthContext);
  const [room, setRoom] = useState<RoomData | null>(null);
  type DisplayMode = "observe" | "input" | "full";
  const displayMode = signal<DisplayMode>("full");
  const timerMode = signal<TimerOption>("off");
  const [selectedGame, setSelectedGame] = useState<GameName | "_join" | null>(null);

  const handleCreateGame = async (gameName: GameName) => {
    if (user && !user.isAnonymous) {
      const isPlayer = displayMode.value !== "observe";
      const id = await createGame({
        gameName, 
        isPlayer,
        _creator: user.uid,
        timer: timerMode.value,
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
    joinRoom(code, displayMode.value !== "observe", setRoom);
  }

  const DisplayOptions = () => {
    const options:{value: DisplayMode, label: string}[] = [
      {value: "full", label: "Playing without a shared screen"},
      {value: "input", label: "Playing with a shared screen"},
      {value: "observe", label: "Observing only / shared screen"},
    ];
    return <Options<DisplayMode> 
      id="DisplayOptions"
      label="This display is for:"
      options={options} 
      onSet={(v: DisplayMode) => { displayMode.value = v; }} />
  }
  const TimerOptions = () => {
    const options = (["off", "slow", "fast"] as TimerOption[]).map(v => {
      return {label: v as string, value: v};
    });
    return <Options<TimerOption> 
        id="TimerOptions"
        label="Timer:"
        options={options} 
        onSet={(v: TimerOption) => { timerMode.value = v; }} />
  }

  const Options = <O extends string,>(props: {
    id: string,
    label: string,
    options: {label: string, value: O}[],
    onSet: (value: O) => void,
  }) => {
    const [value, setValue] = useState(props.options[0].value);
    return <>
      <label for={props.id}>{props.label}</label>
      <fieldset id={props.id}>
        {props.options.map(o => {
          return <div key={o.value}>
          <input type="radio" 
            id={o.value} 
            onChange={() => { setValue(o.value); props.onSet(o.value); }} 
            checked={o.value === value} />
          <label for={o.value}>{o.label}</label>
        </div>
        })}
      </fieldset>
    </>
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
      isPlayer: displayMode.value !== "observe",
      isInputOnly: displayMode.value === "input",
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