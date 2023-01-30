import { h, Fragment } from "preact";
import { useEffect, useContext } from "preact/hooks";
import { AuthContext } from "../../AuthProvider"
import { PromptGuessMessage, PromptGuessRoom } from "../../../functions/src/games/promptGuessBase"
import { GameName } from "../../../functions/src/games/games";
import { PromptGuessBase } from "./PromptGuessBase";
import { Farsketched, Gisticle, Tresmojis } from "./PromptGuessers";

import { messageRoom } from "../../actions";
import { RoomData } from "../../Room";

const GameMap = new Map<GameName, typeof PromptGuessBase>();
GameMap.set("farsketched", Farsketched);
GameMap.set("gisticle", Gisticle);
GameMap.set("tresmojis", Tresmojis);

export function RenderPromptGuess(props: {
  room: RoomData,
  gameState: PromptGuessRoom["gameState"],
  players: PromptGuessRoom["players"],
}) {
  const { user } = useContext(AuthContext);
  if (!user) {
    throw new Error("User isn't defined in game renderer!");
  }

  const engine = GameMap.get(props.room.gameName);

  const message = (type: PromptGuessMessage["type"], value: string) => {
    if (user) {
      const m:PromptGuessMessage = {
        type: type,
        value: value,
        uid: user.uid,
      }
      messageRoom(props.room.id, m);
    }
  }

  if (!engine) {
    return <></>
  } else {
    return <>
    {props.players[user.uid].state === "Lobby"
      ? <p>While you wait, this game engine has a surprise!
        <button onClick={() => {message("Start", "yum")}}>Make it go boom!</button>
      </p>
      : <></>}
    {props.players[user.uid].state === "Intro"
      ? <engine.Intro introVideoUrl={props.room.introVideoUrl} />
      : <></>}
    {props.players[user.uid].state === "Prompt"
      ? <engine.Prompt onSubmit={(v: string) => {message("Prompt", v)}} 
                       template={props.players[user.uid].template} />
      : <></>}
    {props.players[user.uid].state === "Lie" && props.gameState.currentGeneration
      ? <>
      <engine.Lie onSubmit={(v: string) => {message("Lie", v)}} 
                  template={props.gameState.generations[props.gameState.currentGeneration].template}/>
      <engine.Generation generation={props.gameState.generations[props.gameState.currentGeneration]} />
      </>
      : <></>}
    {props.players[user.uid].state === "Vote" 
      ? <engine.LieChoices onSubmit={(v: string) => {message("Vote", v)}} lies={props.gameState.lies} />
      : <></>}
    {props.players[user.uid].state === "Score"
      ? <engine.Scoreboard scores={props.gameState.scores} />
      : <></>}
    </>
  }
  
}
