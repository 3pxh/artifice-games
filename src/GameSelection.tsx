import { h, Fragment } from "preact";
import { useState, useContext, useEffect } from "preact/hooks";
import { signal } from "@preact/signals";
import { get, ref } from "@firebase/database";
import { GameDefinition, TimerOption } from "../functions/src/games/games";
import { db } from "./firebaseClient";
import { AuthContext } from "./AuthProvider"
import { Routes } from "./router";
import { createGame, joinRoom, getRoom } from "./actions";
import { Room, RoomData } from "./Room";
import SubmittableInput from "./components/SubmittableInput";
import { Link } from "preact-router";
type AsyncOption = "async" | "live";
type DisplayMode = "observe" | "input" | "full";


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
const TimerOptions = (props: {onSet: (v: TimerOption) => void}) => {
  const options = (["off", "slow", "fast"] as TimerOption[]).map(v => {
    return {label: v as string, value: v};
  });
  return <Options<TimerOption> 
      id="TimerOptions"
      label="Timer:"
      options={options} 
      onSet={props.onSet} />
}

const AsyncOptions = (props: {onSet: (v: AsyncOption) => void}) => {
  const options = (["live", "async"] as AsyncOption[]).map(v => {
    return {label: v as string, value: v};
  });
  return <Options<AsyncOption> 
      key="AsyncOptions"
      id="AsyncOptions"
      label="Live session or async?"
      options={options} 
      onSet={props.onSet} />
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

export default function GameSelection() {
  const authContext = useContext(AuthContext);
  const displayMode = signal<DisplayMode>("full");
  const timerMode = signal<TimerOption>("off");
  const [asyncMode, setAsyncMode] = useState<AsyncOption>("live");
  const [selectedGame, setSelectedGame] = useState<string | "_join" | null>(null);
  // TODO: Create a loading boundary component which takes an optional prop and
  // a component which needs that prop, renders loading indicator while the prop
  // is null, otherwise renders the component with the prop.
  const [loadingRoom, setLoadingRoom] = useState(false);
  const [gameList, setGameList] = useState<{[id: string]: GameDefinition}>({});
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    get(ref(db, "games")).then(v => {
      setGameList(v.val());
    });
  }, []);

  const handleCreateGame = async (gameId: string) => {
    if (authContext.user && !authContext.user.isAnonymous) {
      setLoadingRoom(true);
      const isPlayer = displayMode.value !== "observe";
      createGame({
        gameId, 
        isPlayer,
        _creator: authContext.user.uid,
        _isAsync: asyncMode === "async",
        timer: timerMode.value,
      }, (id: string) => {
        Routes.navigate(Routes.room.forId(id));
      }, (e: string) => {
        setErrorMessage(e);
        setLoadingRoom(false);
      });
    } else {
      setErrorMessage("Cannot create a game as an anonymous user");
    }
  }

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

  const Join = () => {
    return <div class="GameSelection-Join">
      <DisplayOptions  onSet={(v: DisplayMode) => { displayMode.value = v; }} />
      <SubmittableInput label="Room code:" onSubmit={handleJoinRoom} buttonText="Join" />
      <p style="color:yellow;">{errorMessage}</p>
    </div>
  }

  if (!authContext.user) {
    return <>Must be logged in to create or join a game.</>
  }

  if (loadingRoom) {
    return <p>Loading room data...</p>
  } else if (authContext.user.isAnonymous || !authContext.user.emailVerified || selectedGame === "_join") {
    return <Join />
  } else if (selectedGame === null) {
    return <>
    <div class="GameSelection-GameList">
      <h1>Create a game</h1>
      {Object.entries(gameList).map(([k, v]) => {
        return <button 
          className={v.tier === "Free" ? "GameSelection-FreeTier" : "GameSelection-PaidTier"}
          onClick={() => {setSelectedGame(k)}}
          // TODO: #billing, how do we display different tiers of games?
          // disabled={v.tier !== "Free" && !authContext.isPaid()}
        >
            {v.name}
        </button>
      })}
      <h1>Or,</h1>
      <button className="GameSelection-Join" onClick={() => {setSelectedGame("_join")}}>Join a game</button>
    </div>
  </>
  } else {
    
    return <div class="GameSelection">
      <h1>
        <button onClick={() => {setSelectedGame(null)}}
        style="border-radius:50%;width:36px;height:36px;background-color:yellow;border:none; font-size:20pt;">←</button>
        {gameList[selectedGame].name}
      </h1>
      <p style="color:yellow;">{errorMessage}</p>
      {gameList[selectedGame].introVideo.url 
      ? <>
        <iframe class="YoutubeEmbed" src={`${gameList[selectedGame].introVideo.url}`}></iframe>
      </>
      : ""}
      {gameList[selectedGame].tier === "Underwriter" && !authContext.isPaid() 
      ? <><Link href="/support">Support Artifice</Link> to play this game.</>
      : <>
        <AsyncOptions onSet={(v: AsyncOption) => { setAsyncMode(v); }} />
        {asyncMode === "live" 
          ? <>
            <DisplayOptions onSet={(v: DisplayMode) => { displayMode.value = v; }} />
            <TimerOptions onSet={(v: TimerOption) => { timerMode.value = v; }} />
          </>
          : ""}
        {(asyncMode === "async" && !authContext.isPaid())
        ? <><Link href="/support">Support Artifice</Link> to start async games</>
        : <button onClick={() => {handleCreateGame(selectedGame)}}>Create room</button>}
      </>}
    </div>
  }
}
