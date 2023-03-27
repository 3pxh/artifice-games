import { h, Fragment } from "preact"
import { useContext, useState } from "preact/hooks"
import { AuthContext } from "../AuthProvider";
import { signal } from "@preact/signals";
import { Routes } from "../router";
import { joinRoom } from "../actions";
import SubmittableInput from "../components/SubmittableInput";
type DisplayMode = "observe" | "input" | "full";

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

const DisplayOptions = (props: {onSet: (v: DisplayMode) => void}) => {
  const options:{value: DisplayMode, label: string}[] = [
    {value: "full", label: "My controller + game display"},
    // This has been confusing and needs better communication.
    // {value: "input", label: "Just my controller"},
    {value: "observe", label: "Just for observing, not playing"},
  ];
  return <Options<DisplayMode> 
    id="DisplayOptions"
    label="This display is:"
    options={options} 
    onSet={props.onSet} />
}

export default function Join() {
  const authContext = useContext(AuthContext);
  const [loadingRoom, setLoadingRoom] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const displayMode = signal<DisplayMode>("full");

  const handleJoinRoom = (roomCode: string) => {
    setLoadingRoom(true);
    const code = roomCode.toUpperCase();
    console.log("Trying to join room", code);
    joinRoom(
      code, 
      displayMode.value !== "observe",
      (id: string) => {
        Routes.navigate(Routes.room.forId(id));
      }, 
      (e: string) => {
        setErrorMessage(e);
        setLoadingRoom(false);
      }
    );
  }

  if (authContext.user && !loadingRoom) {
    return <div class="GameSelection-Join">
      <h1>Join a game</h1>
      <DisplayOptions  onSet={(v: DisplayMode) => { displayMode.value = v; }} />
      <SubmittableInput label="Room code:" onSubmit={handleJoinRoom} buttonText="Join" />
      <p style="color:yellow;">{errorMessage}</p>
    </div>
  } else if (loadingRoom) {
    return <div class="GameSelection-Join">
      <h1>Join a game</h1>
      <p>Loading...</p>
    </div>
  } else {
    return <div class="Join">
      Log in to join a game.
    </div>
  }
}