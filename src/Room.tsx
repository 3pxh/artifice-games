import { ref, onValue, DataSnapshot } from "@firebase/database";
import { db } from "./firebaseClient";
import { h, Fragment } from "preact";
import { useContext, useEffect, useState } from "preact/hooks";
import { useSignal, useComputed, Signal, signal } from "@preact/signals";
import { QueueRoom, QueueData } from "../functions/src/index";
import { AuthContext } from "./AuthProvider";
import { messageRoom, pingRoom, updatePlayer, setRoomLastSeenNow } from "./actions";

// TODO: figure out how we want to handle distinct rendering engines and game state objects
// This goes along with more modular gameState types below
import { EngineName, Scores } from "../functions/src/games/games";
import { RenderPromptGuess } from "./games/PromptGuess/Renderer";
import * as AIJudge from "./games/AIJudge/Renderer";
import { PromptGuessRoom, PromptGuessTimer, PromptGuessMessage } from "../functions/src/games/promptGuessBase";
import SlowBroadcastInput from "./components/SlowBroadcastInput";
import AvatarPicker from "./components/AvatarPicker";
import PlayerStatuses from "./components/PlayerStatuses";

// TODO: make the type of this depend on the game in question
// Or rather, include the various room types
type RoomProps = {
  id: string,
  isPlayer: boolean,
  isInputOnly: boolean,
}
export type RoomData = QueueRoom & RoomProps & {definition: {name: string, engine: EngineName, introVideo: {url: string, duration: number}}};
type GameState = {
  timer: PromptGuessTimer,
  scores: Scores,
  state: "Lobby"
}


const GameTimer = (props: {roomId: string, uid: string, gameState: Signal<GameState | null>}) => {
  const timer = useComputed<PromptGuessTimer | null>(() => props.gameState.value?.timer ?? null);
  const timeRemaining = signal(
    timer.value 
      ? Math.floor((timer.value.started + timer.value.duration - new Date().getTime())/1000)
      : 3600 * 24);
  const [endTime, setEndTime] = useState(0);
  // Only message once per timer expiry. There was a bug which was flooding
  // the server with messages (once a second). There's probably a better
  // pattern than this, but it will do for now.
  const [hasMessaged, setHasMessaged] = useState(false);

  useEffect(() => {
    if (timer.value && timer.value.started + timer.value.duration !== endTime) {
      setEndTime(timer.value.started + timer.value.duration);
      setHasMessaged(false); // Only reset when the end time changes.
    }
  });

  useEffect(() => {
      const i = window.setInterval(() => {
        if (timer.value && !hasMessaged) {
          const t = timer.value.started + timer.value.duration - new Date().getTime();
          timeRemaining.value = Math.floor(t/1000);
          if (t < 0) {
            window.clearInterval(i);
            const m:PromptGuessMessage = {
              type: "OutOfTime",
              uid: props.uid,
              value: "ping",
            };
            setHasMessaged(true);
            messageRoom(props.roomId, m);
          }
        }
      }, 1000);
      return () => { window.clearInterval(i); }
  });

  if (timer.value && timer.value.duration > 0 && timeRemaining.value < 3600*24) {
    return <div key="GameTimer" class="Room-Timer">
      {timeRemaining.value > 0 ? `Time remaining: ${timeRemaining.value} seconds` : "Out of time!"}
    </div>
  } else {
    return <></>
  }
}

export function Room(props: {room: RoomData}) {
  const [isWaiting, setIsWaiting] = useState<boolean>(true);
  const [startTime, setStartTime] = useState<number>(0);
  const gameState = useSignal<GameState | null>(null);
  const players = useSignal<PromptGuessRoom["players"] | null>(null);
  const scores = useComputed<Scores | null>(() => gameState.value?.scores ?? null);
  const isLoaded = useComputed<boolean>(() => {
    return gameState.value !== null && players.value !== null;
  });
  const isLobby = useComputed<boolean>(() => {
    return gameState.value?.state === "Lobby";
  });

  const updateGameState = (snapshot: DataSnapshot) => {
    gameState.value = snapshot.val();
  }
  const updatePlayerState = (snapshot: DataSnapshot) => {
    players.value = snapshot.val();
  }

  useEffect(() => {
    // TODO: Make this ack when the game updates here.
    // As is, they have to reload the room to ack.
    setRoomLastSeenNow(props.room.id);
    const stateRef = ref(db, `rooms/${props.room.id}/gameState`);
    onValue(stateRef, updateGameState);
    const playerRef = ref(db, `rooms/${props.room.id}/players`);
    onValue(playerRef, updatePlayerState);
    // TODO: When we add async rooms, how do we handle queuing?
    // In case the component has been rerendered.
    if (isWaiting) {
      const id = window.setInterval(() => {
        pingRoom(props.room.id);
      }, 5000);
      const roomRef = ref(db, `rooms/${props.room.id}/_queue`);
      onValue(roomRef, (snapshot: DataSnapshot) => {
        const v = snapshot.val() as QueueData;
        if (!v.inQueue) {
          window.clearInterval(id);
          setIsWaiting(false);
        } else {
          setStartTime(v.startTime);
        }
      });
    }
    // TODO: should we return a cleanup function that clears the interval?
    // The interval might continue going if we unmount?
  }, [props.room.id]);

  const authContext = useContext(AuthContext);

  const Header = () => {
    // TODO: for async games, this room code could well be expired.
    // We should instead have an invite link with the room id.
    // Max room size? Could go on the room, set at create given the user's paid level.
    return (
      <>
        <p>You are playing: {props.room.definition.name} | Code: {props.room._shortcode}</p>
      </>
    )
  }

  const WaitTime = () => {
    const [currentTime, setCurrentTime] = useState<number>(new Date().getTime());

    useEffect(() => {
      const i = window.setInterval(() => {
        console.log(startTime);
        setCurrentTime(new Date().getTime());
      }, 1000);
      return () => { window.clearInterval(i); }
    })
    const waitTimeS = Math.floor((startTime - currentTime)/1000);
    // TODO: format with a padded 0, e.g. 0:06
    const formattedWaitTime = `${Math.floor(waitTimeS/60)}:${waitTimeS % 60}`;
    if (startTime > 0 && waitTimeS > 0) {
      return <p>This room is #{1+Math.floor(waitTimeS/15)} in the queue, it will appear in {formattedWaitTime}</p>
    } else if (startTime > 0 && waitTimeS <= 0) {
      return <p>Initializing game...</p>
    } else {
      return <p>Calculating queue...</p>
    }
  }

  const PlayerHandleInput = () => {
    return <>
      <label for="PlayerName">Name: </label>
      <SlowBroadcastInput 
        broadcast={(v: string) => {
          const m:Partial<PromptGuessRoom["players"]["uid"]> = {"handle": v}
          updatePlayer(props.room.id, m);
        }}
        input={<input id="PlayerName" />} 
      />
    </>
  }

  
  const engines = {
    "PromptGuess": RenderPromptGuess,
    "AIJudge": AIJudge.RenderAIJudge,
  }
  const Game = engines[props.room.definition.engine];

  if (isWaiting) {
    return <>
      <Header />
      <WaitTime />
    </>
  } else if (isLoaded && authContext.user) {
    return <>
      <Header />
      <GameTimer 
        key={"timer"} 
        roomId={props.room.id} 
        uid={authContext.user.uid}
        gameState={gameState} />
      {isLobby.value
      ? <>
        <PlayerHandleInput />
        <AvatarPicker 
          players={players as Signal<PromptGuessRoom["players"]>}
          onSelect={(v: string) => {
            const m:Partial<PromptGuessRoom["players"]["uid"]> = {"avatar": v}
            updatePlayer(props.room.id, m);
          }} />
          {/* Continue / start button?
          Which only shows once they set an avatar/name */}
      </>
      : <></>
      }
      <PlayerStatuses 
        key={"status"} 
        players={players as Signal<PromptGuessRoom["players"]>} 
        scores={scores.value} />
      <Game 
        key={"game"}
        room={props.room as any}
        // TODO: How do we do manage type checking at the room level?
        gameState={gameState as any}
        players={players as any}
        isPlayer={props.room.isPlayer}
        isInputOnly={props.room.isInputOnly} />
    </>
  } else {
    return <Header />
  }
}