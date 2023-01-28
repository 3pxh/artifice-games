import { get, ref, onValue, DataSnapshot } from "@firebase/database";
import { db } from "./firebaseClient";
import { h, Fragment } from "preact";
import { useContext, useEffect, useState } from "preact/hooks";
import { AuthContext } from "./AuthProvider";
// TODO: figure out how we want to handle distinct rendering engines and game state objects
import { RenderPromptGuess } from "./games/PromptGuess/Renderer";
import { GameState } from "./games/PromptGuess/PromptGuessBase";

export function Game(props: {roomId: string}) {
  const [gameState, setGameState] = useState<GameState | null>(null);

  const updateGameState = (snapshot: DataSnapshot) => {
    setGameState(snapshot.val());
    console.log("setting state", snapshot.val())
  }

  useEffect(() => {
    const stateRef = ref(db, `rooms/${props.roomId}/gameState`);
    get(stateRef).then(updateGameState);
    onValue(stateRef, updateGameState);
  }, [props.roomId]);

  const authContext = useContext(AuthContext);
  return (
    <>
      <p>Welcome, {authContext.user?.displayName ?? "anonymous"}. In the lobby for room: {props.roomId}.</p>
      <p>Game state: {gameState?.state}</p>
      {gameState 
        ? <RenderPromptGuess gameName={"farsketched"} gameState={gameState} />
        : <p>Loading Game State...</p>}
    </>
  )
}