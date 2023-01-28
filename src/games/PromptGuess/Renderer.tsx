import { h, Fragment } from "preact";
import { useAuth } from "../../AuthProvider"
import { PromptGuessBase, GameState, States} from "./PromptGuessBase";
import { Farsketched } from "./Farsketched";
import { GameNames } from "../../gameTypes";
import { messageRoom } from "../../actions";

const GameMap = new Map<GameNames, typeof PromptGuessBase>();
GameMap.set("farsketched", Farsketched);

export function RenderPromptGuess(props: {
  gameName: GameNames,
  roomId: string,
  gameState: GameState
}) {
  const { user } = useAuth();
  const engine = GameMap.get(props.gameName);

  const message = (type: string, value: string) => {
    messageRoom(props.roomId, {
      type: type,
      value: value,
      uid: user?.uid
    });
  }

  if (!engine) {
    return <></>
  } else {
    return <>
    {props.gameState.state === States.Lobby 
      ? <p>While you wait, this game engine has a surprise!
        <button onClick={() => {message("hum", "yum")}}>Make it go boom!</button>
      </p>
      : <></>}
    {props.gameState.state === States.Prompt 
      ? <engine.Prompt onSubmit={(v: string) => {message("Prompt", v)}} />
      : <></>}
    {props.gameState.state === States.Lie 
      ? <>
      <engine.Lie onSubmit={(v: string) => {message("Lie", v)}} />
      <engine.Generation generation={props.gameState.generation} />
      </>
      : <></>}
    {props.gameState.state === States.Vote 
      ? <engine.LieChoices onSubmit={(v: string) => {message("Vote", v)}} lies={props.gameState.lies} />
      : <></>}
    {props.gameState.state === States.Score 
      ? <engine.Scoreboard scores={props.gameState.scores} />
      : <></>}
    </>
  }
  
}
