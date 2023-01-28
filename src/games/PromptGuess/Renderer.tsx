import { h, Fragment } from "preact";
import { useAuth } from "../../AuthProvider"
import { PromptGuessMessage, PromptGuessRoom } from "../../../functions/src/games/promptGuessBase"
import { PromptGuessBase } from "./PromptGuessBase";
import { Farsketched } from "./Farsketched";
import { GameNames } from "../../gameTypes";
import { messageRoom } from "../../actions";
import { useEffect } from "preact/hooks";

const GameMap = new Map<GameNames, typeof PromptGuessBase>();
GameMap.set("farsketched", Farsketched);

export function RenderPromptGuess(props: {
  gameName: GameNames,
  roomId: string,
  gameState: PromptGuessRoom['gameState']
}) {
  const { user } = useAuth();
  const engine = GameMap.get(props.gameName);

  const message = (type: PromptGuessMessage["type"], value: string) => {
    if (user) {
      const m:PromptGuessMessage = {
        type: type,
        value: value,
        uid: user?.uid,
      }
      messageRoom(props.roomId, m);
    }
  }

  useEffect(() => {
    console.log("Game state changed:", props.gameState)
  })

  if (!engine) {
    return <></>
  } else {
    return <>
    {props.gameState.state === "Lobby"
      ? <p>While you wait, this game engine has a surprise!
        <button onClick={() => {message("Start", "yum")}}>Make it go boom!</button>
      </p>
      : <></>}
    {props.gameState.state === "Prompt"
      ? <engine.Prompt onSubmit={(v: string) => {message("Prompt", v)}} />
      : <></>}
    {props.gameState.state === "Lie" && props.gameState.currentGeneration
      ? <>
      <engine.Lie onSubmit={(v: string) => {message("Lie", v)}} />
      <engine.Generation generation={props.gameState.generations[props.gameState.currentGeneration]} />
      </>
      : <></>}
    {props.gameState.state === "Vote" 
      ? <engine.LieChoices onSubmit={(v: string) => {message("Vote", v)}} lies={props.gameState.lies} />
      : <></>}
    {props.gameState.state === "Score"
      ? <engine.Scoreboard scores={props.gameState.scores} />
      : <></>}
    </>
  }
  
}
