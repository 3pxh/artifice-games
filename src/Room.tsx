import { get, ref, onValue, DataSnapshot } from "@firebase/database";
import { db } from "./firebaseClient";
import { h, Fragment } from "preact";
import { useContext, useEffect, useState } from "preact/hooks";
import { GameName } from "../functions/src/games/games";
import { QueueRoom } from "../functions/src/index";
import { AuthContext } from "./AuthProvider";
// TODO: figure out how we want to handle distinct rendering engines and game state objects
// This goes along with more modular gameState types below
import { RenderPromptGuess } from "./games/PromptGuess/Renderer";
import { PromptGuessRoom } from "../functions/src/games/promptGuessBase";

// TODO: make the type of this depend on the game in question
// Or rather, include the various room types
export type RoomData = QueueRoom & PromptGuessRoom & {id: string};

export function Room(props: {room: RoomData}) {
  const [gameState, setGameState] = useState<PromptGuessRoom["gameState"] | null>(null);
  const [players, setPlayers] = useState<PromptGuessRoom["players"] | null>(null);

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

  if (gameState && players && authContext.user && players[authContext.user.uid]) {
    return <>
      <Header />
      <RenderPromptGuess 
            room={props.room}
            gameState={gameState}
            players={players} />
    </>
  } else {
    return <Header />
  }
}