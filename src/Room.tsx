import { get, ref, onValue, DataSnapshot } from "@firebase/database";
import { db } from "./firebaseClient";
import { h, Fragment } from "preact";
import { useContext, useEffect, useState } from "preact/hooks";
import { GameName } from "../functions/src/games/games";
import { AuthContext } from "./AuthProvider";
// TODO: figure out how we want to handle distinct rendering engines and game state objects
// This goes along with more modular gameState types below
import { RenderPromptGuess } from "./games/PromptGuess/Renderer";
import { PromptGuessRoom } from "../functions/src/games/promptGuessBase";

export type RoomData = {
  id: string,
  shortcode: string,
  gameName: GameName,
  introVideoUrl?: string,
  _initialized: boolean,
}

export function Room(props: {room: RoomData}) {
  // TODO: make the type of these depend on the game in question
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
    get(stateRef).then(updateGameState);
    onValue(stateRef, updateGameState);
    const playerRef = ref(db, `rooms/${props.room.id}/players`);
    get(playerRef).then(updatePlayerState);
    onValue(playerRef, updatePlayerState);
  }, [props.room.id]);

  const authContext = useContext(AuthContext);
  return (
    <>
      <p>Welcome, {authContext.user?.displayName ?? "anonymous"}. In the lobby for room: {props.room.id}.</p>
      <p>Game state: {gameState?.state}</p>
      {gameState && players
        ? <RenderPromptGuess 
            room={props.room}
            gameState={gameState}
            players={players} />
        : <p>Loading Game State...</p>}
    </>
  )
}