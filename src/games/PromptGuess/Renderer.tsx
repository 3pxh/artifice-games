import { h, Fragment } from "preact";
import { useContext } from "preact/hooks";
import { computed, Signal, ReadonlySignal } from "@preact/signals";
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
  gameState: Signal<PromptGuessRoom["gameState"]>,
  players: Signal<PromptGuessRoom["players"]>,
  isPlayer: boolean,
  isInputOnly: boolean,
}) {
  const { user } = useContext(AuthContext);
  if (!user) {
    throw new Error("User isn't defined in game renderer!");
  }
  
  const renderState:ReadonlySignal<PromptGuessState> = computed(() => {
    return props.isPlayer 
      ? props.players.value[user.uid].state
      : props.gameState.value.state
  });
  const genAuthor = computed(() => props.gameState.value.currentGeneration)
  const gens = computed(() => props.gameState.value.generations)
  const currentGeneration = computed(() => genAuthor.value && gens.value && gens.value[genAuthor.value] ? gens.value[genAuthor.value] : null)
  // Don't want to rerender the prompt input when players changes.
  const myTemplate = computed(() => props.players.value[user.uid].template);
  

  const engine = GameMap.get(props.room.gameName as GameName);
  if (!engine) {
    throw new Error("Trying to render without a game engine!");
  } 

  const submit = (type: PromptGuessMessage["type"], value: string) => {
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
  
  
  if (renderState.value === "Lobby") {
    return <>
      <p>While you wait, this game engine has a surprise!</p>
      <button onClick={() => {message("Start", "yum")}}>Make it go boom!</button>
    </>
  } else if (renderState.value === "Intro") {
    return <engine.Intro introVideoUrl={props.room.introVideoUrl} />
  } else if (renderState.value === "Prompt") {
    return <engine.Prompt onSubmit={(v: string) => {submit("Prompt", v)}} 
                          template={myTemplate.value} />
  } else if (renderState.value === "Lie") {
    if (currentGeneration.value) {
      return <>
        <engine.Generation generation={currentGeneration.value} />
        <engine.Lie onSubmit={(v: string) => {submit("Lie", v)}} 
                    generation={currentGeneration.value}/>
      </>
    } else {
      return <p>Receiving prompts...</p>
    }
  } else if (renderState.value === "Vote" && currentGeneration.value && props.gameState.value.lies) {
    if (genAuthor.value === user.uid ) {
      return <>
        <p>What did people think you said?</p>
        <ul>
          {shuffledOptions(props.gameState.value).map(o => {
            return <li class="HasUserText" key={o.uid}>{o.prompt}</li>
          })}
        </ul>
        <engine.Generation generation={currentGeneration.value} />
      </>
    } else {
      return <>
        <engine.Generation generation={currentGeneration.value} />
        <engine.LieChoices onSubmit={(v: string) => {submit("Vote", v)}} options={shuffledOptions(props.gameState.value)} />
      </>
    }
  } else if (renderState.value === "Score" && currentGeneration.value) {
    return <>
      <engine.Scoreboard 
        scores={props.gameState.value.scores}
        onContinue={() => {message("ReadyToContinue", "")}} />
      <engine.Generation generation={currentGeneration.value}
                        showPrompt={true} />
    </>
  } else if (renderState.value === "Finish") {
    return <>
      <p>You're all winners!</p>
      <engine.Scoreboard 
          scores={props.gameState.value.scores} />
    </>
  } else {
    return <p>Congrats, you hit an unrecognized game state!</p>
  }
  
}
