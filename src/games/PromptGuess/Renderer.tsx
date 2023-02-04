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
  isPlayer: boolean,
  isInputOnly: boolean,
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
        // TODO: we might have to use session id as identifier
        // In the event that a player is logged in on a comp AND phone?
        // The could always anon auth... but there are usability concerns
      }
      messageRoom(props.room.id, m);
    }
  }

  const shuffledOptions = (gs: PromptGuessRoom["gameState"]): {uid: string, prompt: string}[] => {
    if (!gs.currentGeneration || !gs.generations) {
      throw new Error("Trying to construct lies, but don't have a generation!");
    }
    const gen = gs.currentGeneration;
    const truth: [string, string] = [gs.generations[gen].uid, gs.generations[gen].prompt];
    const s = shuffle(Object.entries(gs.lies ?? {}).concat([truth])).map(([uid, prompt]) => {
      return {
        uid: uid,
        prompt: prompt
      }
    });
    return s;
  }

  if (!engine) {
    throw new Error("Trying to render without a game engine!");
  } 
  
  const renderState = props.isPlayer
                        ? props.players[user.uid].state
                        : props.gameState.state;
  
  if (hasSubmitted) {
    return <p>Waiting on other players</p>
  } else if (renderState === "Lobby") {
    return <>
      <p>While you wait, this game engine has a surprise!</p>
      <button onClick={() => {message("Start", "yum")}}>Make it go boom!</button>
    </>
  } else if (renderState === "Intro") {
    return <engine.Intro introVideoUrl={props.room.introVideoUrl} />
  } else if (renderState === "Prompt") {
    return <engine.Prompt onSubmit={(v: string) => {submit("Prompt", v)}} 
                          template={props.players[user.uid].template} />
  } else if (renderState === "Lie") {
    if (props.gameState.currentGeneration && props.gameState.generations) {
      return <>
        <engine.Lie onSubmit={(v: string) => {submit("Lie", v)}} 
                    generation={props.gameState.generations[props.gameState.currentGeneration]}/>
        <engine.Generation generation={props.gameState.generations[props.gameState.currentGeneration]} />
      </>
    } else {
      return <p>Waiting on the AI...</p>
    }
  } else if (renderState === "Vote" && props.gameState.currentGeneration && props.gameState.generations) {
    if (props.gameState.currentGeneration === user.uid ) {
      return <>
        <p>What did people think you said?</p>
        <ul>
          {shuffledOptions(props.gameState).map(o => {
            return <li key={o.uid}>{o.prompt}</li>
          })}
        </ul>
        <engine.Generation generation={props.gameState.generations[props.gameState.currentGeneration]} />
      </>
    } else {
      return <>
        <engine.LieChoices onSubmit={(v: string) => {submit("Vote", v)}} options={shuffledOptions(props.gameState)} />
        <engine.Generation generation={props.gameState.generations[props.gameState.currentGeneration]} />
      </>
    }
  } else if (renderState === "Score" && props.gameState.currentGeneration && props.gameState.generations) {
    return <>
      <engine.Scoreboard 
        scores={props.gameState.scores}
        onContinue={() => {message("ReadyToContinue", "")}} />
      <engine.Generation generation={props.gameState.generations[props.gameState.currentGeneration]}
                        showPrompt={true} />
    </>
  } else if (renderState === "Finish") {
    return <>
      <p>You're all winners!</p>
      <engine.Scoreboard 
          scores={props.gameState.scores} />
    </>
  } else {
    return <p>Unrecognized game state!</p>
  }
  
}
