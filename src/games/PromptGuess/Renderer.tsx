import { h, Fragment } from "preact";
import { PromptGuessBase, GameState, States} from "./PromptGuessBase";
import { Farsketched } from "./Farsketched";
import { GameNames } from "../../gameTypes";

const GameMap = new Map<GameNames, typeof PromptGuessBase>();
GameMap.set("farsketched", Farsketched);

export function RenderPromptGuess(props: {
  gameName: GameNames, 
  gameState: GameState
}) {
  const engine = GameMap.get(props.gameName);

  const submitPrompt = (p: string) => {
  }
  const submitLie = (p: string) => {
  }
  const chooseLie = (id: string) => {
  }

  if (!engine) {
    return <></>
  } else {
    return <>
    {props.gameState.state === States.Lobby 
      ? <p>While you wait, this game engine has a surprise!</p>
      : <></>}
    {props.gameState.state === States.Prompt 
      ? <engine.Prompt onSubmit={submitPrompt} />
      : <></>}
    {props.gameState.state === States.Lie 
      ? <>
      <engine.Lie onSubmit={submitLie} />
      <engine.Generation generation={props.gameState.generation} />
      </>
      : <></>}
    {props.gameState.state === States.Vote 
      ? <engine.LieChoices onSubmit={chooseLie} lies={props.gameState.lies} />
      : <></>}
    {props.gameState.state === States.Score 
      ? <engine.Scoreboard scores={props.gameState.scores} />
      : <></>}
    </>
  }
  
}
