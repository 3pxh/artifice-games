import { ref, onValue, DataSnapshot, query, limitToLast, Unsubscribe } from "@firebase/database";
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
import * as Quip from "./games/Quip/Renderer";
import * as MITM from "./games/MITM/Renderer";
import * as GroupThink from "./games/GroupThink/Renderer";
import { PromptGuessRoom, PromptGuessTimer, PromptGuessMessage } from "../functions/src/games/promptGuessBase";
import SlowBroadcastInput from "./components/SlowBroadcastInput";
import AvatarPicker from "./components/AvatarPicker";
import PlayerStatuses from "./components/PlayerStatuses";
import "./Room.css";

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
    // TODO: styling. e.g. make this a bar with a % width based on time left.
    return <div key="GameTimer" class="Room-Timer">
      {timeRemaining.value > 0 ? `Time remaining: ${timeRemaining.value} seconds` : "Out of time!"}
    </div>
  } else {
    return <></>
  }
}

const WaitTime = (props: {startTime: number}) => {
  const [currentTime, setCurrentTime] = useState<number>(new Date().getTime());

  useEffect(() => {
    const i = window.setInterval(() => {
      console.log(props.startTime);
      setCurrentTime(new Date().getTime());
    }, 1000);
    return () => { window.clearInterval(i); }
  });

  const waitTimeS = Math.floor((props.startTime - currentTime)/1000);
  // TODO: format with a padded 0, e.g. 0:06
  const formattedWaitTime = `${Math.floor(waitTimeS/60)}:${waitTimeS % 60}`;
  if (props.startTime > 0 && waitTimeS > 0) {
    return <p>This room is #{1+Math.floor(waitTimeS/15)} in the queue, it will appear in {formattedWaitTime}</p>
  } else if (props.startTime > 0 && waitTimeS <= 0) {
    return <p>Initializing game...</p>
  } else {
    return <p>Calculating queue...</p>
  }
}

export function Room(props: {room: RoomData}) {
  const [isWaiting, setIsWaiting] = useState<boolean>(true);
  const [startTime, setStartTime] = useState<number>(0);
  const gameState = useSignal<GameState | null>(null);
  const players = useSignal<PromptGuessRoom["players"] | null>(null);
  const scores = useComputed<Scores | null>(() => gameState.value?.scores ?? null);
  const scratchpad = useSignal<any>(null);
  const isLoaded = useComputed<boolean>(() => {
    return gameState.value !== null && players.value !== null;
  });
  const isLobby = useComputed<boolean>(() => {
    return gameState.value?.state === "Lobby";
  });
  const authContext = useContext(AuthContext);
  const hasSetNameAndAvatar = useComputed<boolean>(() => {
    if (authContext.user && authContext.user.uid && players.value) {
      const me = players.value[authContext.user.uid];
      return (me.avatar && me.handle) ? true : false;
    }
    return false;
  })

  const updateGameState = (snapshot: DataSnapshot) => {
    gameState.value = snapshot.val();
  }
  const updateGameStateKey = (key: string, snapshot: DataSnapshot, onlyLast: boolean) => {
    (gameState.value as any) = {
      ...(gameState.value || {}),
      [key]: onlyLast ? {...((gameState.value as any) || {})[key], ...snapshot.val()} : snapshot.val()
    };
  }
  const updatePlayerState = (snapshot: DataSnapshot) => {
    players.value = snapshot.val();
  }
  const updateScratchpadState = (snapshot: DataSnapshot) => {
    scratchpad.value = snapshot.val();
  }

  const engines:Record<EngineName, any> = {
    "PromptGuess": RenderPromptGuess,
    "AIJudge": AIJudge.RenderAIJudge,
    "Quip": Quip.RenderQuip,
    "MITM": MITM.RenderMitm,
    "GroupThink": GroupThink.RenderGroupThink,
  }
  const subscriptions:Record<EngineName, any> = {
    "PromptGuess": undefined,
    "AIJudge": undefined,
    "Quip": undefined,
    "MITM": MITM.Subscriptions,
    "GroupThink": GroupThink.Subscriptions,
  }
  const Game = engines[props.room.definition.engine];
  const GameStateSubscriptions = subscriptions[props.room.definition.engine];

  const unsubscribes:Unsubscribe[] = []
  useEffect(() => {
    setRoomLastSeenNow(props.room.id);
    if (GameStateSubscriptions) {
      const stateRef = ref(db, `rooms/${props.room.id}/gameState`);
      onValue(stateRef, updateGameState, {onlyOnce: true});
      Object.keys(GameStateSubscriptions).forEach((key) => {
        const keyRef = ref(db, `rooms/${props.room.id}/gameState/${key}`);
        const q = GameStateSubscriptions[key] ? query(keyRef, limitToLast(1)) : keyRef;
        const unsub = onValue(q, (snapshot: DataSnapshot) => {
          updateGameStateKey(key, snapshot, GameStateSubscriptions[key]);
        });
        unsubscribes.push(unsub);
      });
    } else {
      const stateRef = ref(db, `rooms/${props.room.id}/gameState`);
      unsubscribes.push(onValue(stateRef, updateGameState));
    }
    const playerRef = ref(db, `rooms/${props.room.id}/players`);
    unsubscribes.push(onValue(playerRef, updatePlayerState));
    // TODO: remove scratchpad // put it under gamestate for quip engine.
    // This was only used before we had subscription splitting.
    const scratchpadRef = ref(db, `rooms/${props.room.id}/scratchpad`);
    unsubscribes.push(onValue(scratchpadRef, updateScratchpadState));
    if (isWaiting) {
      const id = window.setInterval(() => {
        pingRoom(props.room.id);
      }, 5000);
      const roomRef = ref(db, `rooms/${props.room.id}/_queue`);
      const unsub = onValue(roomRef, (snapshot: DataSnapshot) => {
        const v = snapshot.val() as QueueData;
        if (!v.inQueue) {
          window.clearInterval(id);
          setIsWaiting(false);
        } else {
          setStartTime(v.startTime);
        }
      });
      unsubscribes.push(unsub);
    }
    // TODO: should we return a cleanup function that clears the interval?
    // The interval might continue going if we unmount?
  }, [props.room.id]);

  useEffect(() => {
    // Cleanup subscriptions on unmount.
    // 1. Lessens data usage when not viewing a given room
    // 2. Prevents subscribing to the same room multiple times and crashing
    return () => {
      unsubscribes.forEach((unsub) => {
        unsub();
      });
    }
  }, []);

  const Header = () => {
    // TODO: for async games, this room code could well be expired.
    // We should instead have an invite link with the room id.
    // Max room size? Could go on the room, set at create given the user's paid level.
    return <p class="Room-Header">
      You are playing: {props.room.definition.name} | Code: {props.room._shortcode}
    </p>
  }

  if (isWaiting || !gameState.value) {
    return <>
      <Header />
      <WaitTime startTime={startTime} />
    </>
  } else if (isLoaded && authContext.user) {
    return <div className="Room">
      <div className="Room-Pane">
          <Header />
          <GameTimer 
            key={"timer"} 
            roomId={props.room.id} 
            uid={authContext.user.uid}
            gameState={gameState} />
          {(isLobby.value || !hasSetNameAndAvatar.value)
          // TODO: improve the UX.
          // As soon as they set avatar/name this disappears, no confirmation
          ? <>
            <div class="Room-PlayerHandleInput">
              <label for="PlayerName">Name: </label>
              <SlowBroadcastInput 
                broadcast={(v: string) => {
                  const m:Partial<PromptGuessRoom["players"]["uid"]> = {"handle": v}
                  updatePlayer(props.room.id, m);
                }}
                input={<input id="PlayerName" />} 
              />
            </div>
            <AvatarPicker 
              players={players as Signal<PromptGuessRoom["players"]>}
              onSelect={(v: string) => {
                const m:Partial<PromptGuessRoom["players"]["uid"]> = {"avatar": v}
                updatePlayer(props.room.id, m);
              }} />
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
            gameState={gameState as any}
            players={players as any}
            scratchpad={scratchpad as any}
            isPlayer={props.room.isPlayer}
            isInputOnly={props.room.isInputOnly} />
        </div>
    </div>
  } else {
    return <Header />
  }
}