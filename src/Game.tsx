import { get, ref, onValue, DataSnapshot } from "@firebase/database";
import { db } from "./firebaseClient";
import { h, Fragment } from 'preact'
import { useContext, useEffect, useState } from 'preact/hooks'
import { AuthContext } from './AuthProvider'

type GameState = {
  state: number
}

export function Game(props: {roomId: string}) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const stateRef = ref(db, `rooms/${props.roomId}/gameState`);

  const updateGameState = (snapshot: DataSnapshot) => {
    setGameState(snapshot.val());
    console.log("setting state", snapshot.val())
  }

  useEffect(() => {
    // Load once and subscribe to changes.
    get(stateRef).then(updateGameState);
    onValue(stateRef, updateGameState);
  })

  const authContext = useContext(AuthContext);
  return (
    <>
      <p>In the lobby for room: {props.roomId}.</p>
      {gameState === null ? <p>Loading Game State</p> : <></>}
      <p>Game state: {gameState?.state}</p>
    </>
  )
}