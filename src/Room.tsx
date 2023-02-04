import { get, ref, onValue, DataSnapshot } from "@firebase/database";
import { db } from "./firebaseClient";
import { h, Fragment } from "preact";
import { useContext, useEffect, useState } from "preact/hooks";
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
  const [gameState, setGameState] = useState<PromptGuessRoom["gameState"] | null>(null);
  const [players, setPlayers] = useState<PromptGuessRoom["players"] | null>(null);
  const [isWaiting, setIsWaiting] = useState<boolean>(true);
  const [startTime, setStartTime] = useState<number>(0);

  const updateGameState = (snapshot: DataSnapshot) => {
    setGameState(snapshot.val());
    console.log("setting state", snapshot.val())
  }
  const updatePlayerState = (snapshot: DataSnapshot) => {
    setPlayers(snapshot.val());
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
        <p style="display:none;">Game state: {gameState?.state}</p>
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

  const GameTimer = (props: {timer?: Omit<PromptGuessTimer, "stateDurations">, roomId: string, uid: string}) => {
    const [timeRemaining, setTimeRemaining] = useState<number>(new Date().getTime());
    useEffect(() => {
        const i = window.setInterval(() => {
          if (props.timer) {
            const t = props.timer.started + props.timer.duration - new Date().getTime();
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
    }, [props.timer]);

    if (props.timer && props.timer.duration > 0 && timeRemaining < 3600*24) {
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
  } else if (gameState && players && authContext.user && players[authContext.user.uid]) {
    return <>
      <Header />
      <GameTimer timer={gameState.timer} roomId={props.room.id} uid={authContext.user.uid} />
      <RenderPromptGuess 
            room={props.room}
            gameState={gameState}
            players={players}
            isPlayer={props.room.isPlayer}
            isInputOnly={props.room.isInputOnly} />
    </>
  } else {
    return <Header />
  }
}