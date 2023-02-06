import { get, ref, onValue, DataSnapshot } from "@firebase/database";
import { db } from "./firebaseClient";
import { h, Fragment } from "preact";
import { useContext, useEffect, useState } from "preact/hooks";
import { useSignal, useComputed, Signal } from "@preact/signals";
import { QueueRoom, QueueData } from "../functions/src/index";
import { AuthContext } from "./AuthProvider";
import { messageRoom, pingRoom } from "./actions";
// TODO: figure out how we want to handle distinct rendering engines and game state objects
// This goes along with more modular gameState types below
import { RenderPromptGuess } from "./games/PromptGuess/Renderer";
import { PromptGuessRoom, PromptGuessTimer, PromptGuessMessage } from "../functions/src/games/promptGuessBase";

// TODO: make the type of this depend on the game in question
// Or rather, include the various room types
type RoomProps = {
  id: string,
  isPlayer: boolean,
  isInputOnly: boolean,
}
export type RoomData = QueueRoom & PromptGuessRoom & RoomProps;

export function Room(props: {room: RoomData}) {
  const [isWaiting, setIsWaiting] = useState<boolean>(true);
  const [startTime, setStartTime] = useState<number>(0);
  const gameState = useSignal<PromptGuessRoom["gameState"] | null>(null);
  const players = useSignal<PromptGuessRoom["players"] | null>(null);
  const timer = useComputed<PromptGuessTimer | null>(() => gameState.value?.timer ?? null);
  const isLoaded = useComputed<boolean>(() => {
    return gameState.value !== null && players.value !== null;
  })

  const updateGameState = (snapshot: DataSnapshot) => {
    gameState.value = snapshot.val();
    console.log("setting state", snapshot.val())
  }
  const updatePlayerState = (snapshot: DataSnapshot) => {
    players.value = snapshot.val();
    console.log("setting players", snapshot.val())
  }

  useEffect(() => {
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
    return (
      <>
        <p>You are playing: {props.room.gameName} | Code: {props.room._shortcode}</p>
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
      return <p>You are in the queue, the game should start in {formattedWaitTime}</p>
    } else if (startTime > 0 && waitTimeS <= 0) {
      return <p>Starting game...</p>
    } else {
      return <p>Calculating queue...</p>
    }
  }

  const GameTimer = (props: {roomId: string, uid: string}) => {
    const [timeRemaining, setTimeRemaining] = useState<number>(new Date().getTime());
    useEffect(() => {
        const i = window.setInterval(() => {
          if (timer.value) {
            const t = timer.value.started + timer.value.duration - new Date().getTime();
            setTimeRemaining(Math.floor(t/1000));
            if (t < 0) {
              window.clearInterval(i);
              const m:PromptGuessMessage = {
                type: "OutOfTime",
                uid: props.uid,
                value: "ping",
              };
              messageRoom(props.roomId, m);
            }
          }
        }, 1000);
        return () => { window.clearInterval(i); }
    });

    if (timer.value && timer.value.duration > 0 && timeRemaining < 3600*24) {
      return <div class="Room-Timer">
        {timeRemaining > 0 ? `Time remaining: ${timeRemaining} seconds` : "Out of time!"}
      </div>
    } else {
      return <></>
    }
  }

  if (isWaiting) {
    return <>
      <Header />
      <WaitTime />
    </>
  } else if (isLoaded && authContext.user) { //&& gameState && players && players[authContext.user.uid]
    return <>
      <Header />
      <GameTimer roomId={props.room.id} uid={authContext.user.uid} />
      <RenderPromptGuess 
            room={props.room}
            // WARNING! We do these typecasts because the isLoaded is a computed null guard.
            // We DO NOT want to check the values of these signals directly, because
            // that would necessitate a rerender on every update. We want the signals
            // passed down (not accessing their values) with minimal rerenders for things 
            // like retaining focus on input fields.
            gameState={gameState as Signal<PromptGuessRoom["gameState"]>}
            players={players as Signal<PromptGuessRoom["players"]>}
            isPlayer={props.room.isPlayer}
            isInputOnly={props.room.isInputOnly} />
    </>
  } else {
    return <Header />
  }
}