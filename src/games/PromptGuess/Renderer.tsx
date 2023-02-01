import { h, Fragment } from "preact";
import { useContext, useEffect, useState } from "preact/hooks";
import { PromptGuessMessage, PromptGuessRoom, PromptGuessState } from "../../../functions/src/games/promptGuessBase"
import { shuffle } from "../../../functions/src/utils";
import { AuthContext } from "../../AuthProvider"
import { GameName } from "../../../functions/src/games/games";
import * as PromptGuessBase from "./PromptGuessBase";
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
  const [roomState, setRoomState] = useState<PromptGuessState>("Lobby");
  const [hasSubmitted, setHasSubmitted] = useState(false);

  if (!user) {
    throw new Error("User isn't defined in game renderer!");
  }

  useEffect(() => {
    // We'll need to do something like this. We could alternatively
    // always write the player state, and account for each waiting state.
    // But that seems unnecessarily verbose at the moment.
    if (props.gameState.state !== roomState) {
      setHasSubmitted(false);
      setRoomState(props.gameState.state);
    }
  })

  const engine = GameMap.get(props.room.gameName as GameName);

  const submit = (type: PromptGuessMessage["type"], value: string) => {
    setHasSubmitted(true);
    message(type, value);
  }

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

  const shuffledOptions = (gs: PromptGuessRoom["gameState"]): {uid: string, prompt: string}[] => {
    if (!gs.currentGeneration) {
      throw new Error("Trying to construct lies, but don't have a generation!");
    }
    const gen = gs.currentGeneration;
    const truth: [string, string] = [gs.generations[gen].uid, gs.generations[gen].prompt];
    const s = shuffle(Object.entries(gs.lies).concat([truth])).map(([uid, prompt]) => {
      return {
        uid: uid,
        prompt: prompt
      }
    });
    return s;
  }

  if (!engine) {
    throw new Error("Trying to render without a game engine!");
  } else {
    if (hasSubmitted) {
      return <p>Waiting on other players</p>
    } // else ...
    return <>
    {props.players[user.uid].state === "Lobby"
      ? <p>While you wait, this game engine has a surprise!
        <button onClick={() => {message("Start", "yum")}}>Make it go boom!</button>
      </p>
      : <></>}
    {props.players[user.uid].state === "Intro"
      ? <engine.Intro introVideoUrl={props.room.introVideoUrl} />
      : <></>}
    {props.players[user.uid].state === "Prompt" && !hasSubmitted
      ? <engine.Prompt onSubmit={(v: string) => {submit("Prompt", v)}} 
                       template={props.players[user.uid].template} />
      : <></>}
    {props.players[user.uid].state === "Lie" && props.gameState.currentGeneration && !hasSubmitted
      ? <>
      <engine.Lie onSubmit={(v: string) => {submit("Lie", v)}} 
                  generation={props.gameState.generations[props.gameState.currentGeneration]}/>
      <engine.Generation generation={props.gameState.generations[props.gameState.currentGeneration]} />
      </>
      : <></>}
    {props.players[user.uid].state === "Vote" 
      && props.gameState.currentGeneration 
      && props.gameState.currentGeneration !== user.uid // Creator doesn't vote.
      && !hasSubmitted
      ? <>
        <engine.LieChoices onSubmit={(v: string) => {submit("Vote", v)}} options={shuffledOptions(props.gameState)} />
        <engine.Generation generation={props.gameState.generations[props.gameState.currentGeneration]} />
        </>
      : <></>}
    {props.players[user.uid].state === "Vote" 
      && props.gameState.currentGeneration 
      && props.gameState.currentGeneration === user.uid 
      && !hasSubmitted
      ? <><p>What did people think you said?</p><ul>
        {shuffledOptions(props.gameState).map(o => {
          return <li>{o.prompt}</li>
        })}</ul>
        <engine.Generation generation={props.gameState.generations[props.gameState.currentGeneration]} />
        </>
      : <></>}
    {props.players[user.uid].state === "Score" && props.gameState.currentGeneration && !hasSubmitted
      ? <>
        <engine.Scoreboard scores={props.gameState.scores} />
        <engine.Generation generation={props.gameState.generations[props.gameState.currentGeneration]}
                           showPrompt={true} />
      </>
      : <></>}
    </>
  }
  
}
