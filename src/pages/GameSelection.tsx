import { h, Fragment } from "preact";
import { useState, useContext, useEffect } from "preact/hooks";
import { signal } from "@preact/signals";
import { get, ref } from "@firebase/database";
import { GameDefinition, TimerOption } from "../../functions/src/games/games";
import { db } from "../firebaseClient";
import { AuthContext } from "../AuthProvider"
import { Routes } from "../router";
import { createGame } from "../actions";
import { Link } from "preact-router";
import { objectFilter } from "../../functions/src/utils";
import "./GameSelection.css";

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

function GameList(props: {games: [string, GameDefinition][], onSelect: (id: string) => void}) {
  return <div class="GameSelection-GameList">
    {props.games.map(([k, v]) => {
      return <div class="GameSelection-GameCard">
        <button 
          onClick={() => {props.onSelect(k)}}
          style={`background-color: ${v.color || "#DDD"}`}
        >
          <span class="GameSelection-Emoji">{(v as any).emoji || "🎉"}</span><br/>
          {v.name}
        </button>
        <span class="GameSelection-ShortAbout">{v.shortAbout ?? ""}</span>
      </div>
    })}
  </div>;
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
      setGameList(objectFilter(v.val(), (v:GameDefinition) => !v.hidden));
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

  

  if (loadingRoom) {
    return <p>Loading room data...</p>
  } else if (selectedGame === null) {
    return <>
    <div class="GameSelection-Container">
      <h1>Hello, human :)</h1>
      <h2><em>free this week</em></h2>
      <GameList games={Object.entries(gameList).filter(([_, v]) => v.tier === "Free")} onSelect={setSelectedGame} />
      <h2><em>full catalogue</em></h2>
      <div>{!authContext.isPaid() 
        ? <small><Link href="/support">support artifice and get access to the full catalogue ➔</Link></small> 
        : "Thanks for supporting our games!"
      }</div>
      <GameList games={Object.entries(gameList).filter(([_, v]) => v.tier !== "Free")} onSelect={setSelectedGame} />
    </div>
  </>
  } else if (!authContext.user) {
    return <div class="GameSelection">
      <button onClick={() => {setSelectedGame(null)}}
        style="border-radius:50%;width:36px;height:36px;background-color:yellow;border:none; font-size:20pt;">←</button>
      <Link href="/auth">Log in</Link> to create or join a game.
    </div>
  } else if (!authContext.user.emailVerified) {
    return <div class="GameSelection">
      <button onClick={() => {setSelectedGame(null)}}
        style="border-radius:50%;width:36px;height:36px;background-color:yellow;border:none; font-size:20pt;">←</button>
      Verify {authContext.user.email} to create a game. Refresh after verification.
      <button onClick={() => authContext.verify()}>Re-send verification email</button>
    </div>
  } else {
    
    return <div class="GameSelection">
      <h1>
        <button onClick={() => {setSelectedGame(null)}}
        style="border-radius:50%;width:36px;height:36px;background-color:yellow;border:none; font-size:20pt;">←</button>
        {gameList[selectedGame].name} {gameList[selectedGame].emoji}
      </h1>
      <p style="color:yellow;">{errorMessage}</p>
      {gameList[selectedGame].introVideo.url 
      ? <>
        <iframe class="YoutubeEmbed" src={`${gameList[selectedGame].introVideo.url}`}></iframe>
      </>
      : ""}
      <p>{gameList[selectedGame].about}</p>
      {gameList[selectedGame].tier === "Underwriter" && !authContext.isPaid() 
      ? <><Link href="/support">Support Artifice</Link> to play this game.</>
      : <>
        {/* TODO: #APP re-enable async games  */}
        {/* <AsyncOptions onSet={(v: AsyncOption) => { setAsyncMode(v); }} /> */}
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
