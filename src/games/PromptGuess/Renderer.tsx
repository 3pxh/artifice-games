import { h, Fragment } from "preact";
import { useContext } from "preact/hooks";
import { computed, useComputed, Signal, ReadonlySignal } from "@preact/signals";
import { PromptGuessMessage, PromptGuessRoom, PromptGuessState } from "../../../functions/src/games/promptGuessBase"
import { AuthContext } from "../../AuthProvider"
import * as Engine from "./PromptGuessBase";

import { messageRoom, updatePlayer } from "../../actions";
import { RoomData } from "../../Room";
import SingleUseButton from "../../components/SingleUseButton";

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
    return (props.isPlayer && props.players.value)
      ? props.players.value[user.uid].state
      : props.gameState.value.state
  });
  const genAuthor = computed(() => props.gameState.value.currentGeneration)
  const gens = computed(() => props.gameState.value.generations)
  const currentGeneration = computed(() => genAuthor.value && gens.value && gens.value[genAuthor.value] ? gens.value[genAuthor.value] : null)
  // Don't want to rerender the prompt input when players changes.
  const myTemplate = computed(() => props.players.value[user.uid].template);
  
  const submit = (type: PromptGuessMessage["type"], value: string) => {
    updatePlayer(props.room.id, { isReadyToContinue: true });
    message(type, value);
  }

  const message = (type: PromptGuessMessage["type"], value: string) => {
    const m:Omit<PromptGuessMessage, "uid"> = {
      type: type,
      value: value,
    }
    messageRoom(props.room.id, m);
  }

  // TODO: This works fine but it does recompute more than it should.
  const voteOptions = useComputed(() => {
    const gs = props.gameState.value;
    if (!gs.currentGeneration || !gs.generations) {
      throw new Error("Trying to construct lies, but don't have a generation!");
    }
    const gen = gs.currentGeneration;
    const truth: [string, string] = [gs.generations[gen].uid, gs.generations[gen].prompt];
    // Sort to make Object.entries stable.
    const s = Object.entries(gs.lies ?? {}).concat([truth]).sort(([u1, _], [u2, __]) => u1 < u2 ? 1 : -1).map(([uid, prompt]) => {
      return {
        uid: uid,
        prompt: prompt
      }
    });
    return s;
  })
  
  
  if (renderState.value === "Lobby") {
    return <div class="PromptGuessLobby">
      <SingleUseButton 
        buttonText="Ready to start!" 
        onClick={() => {message("ReadyToContinue", "gogogo!")}}
        postSubmitContent={<>The game will start once everyone's ready.</>} />
    </div>
  } else if (renderState.value === "Intro") {
    return <div>
      {props.room.definition.introVideo.url 
        ? <iframe class="YoutubeEmbed" src={`${props.room.definition.introVideo.url}?autoplay=1`}></iframe>
        : "Instruction video not found."}
      <SingleUseButton 
        key="IntroContinue"
        buttonText="Done watching" 
        onClick={() => {message("ReadyToContinue", "gogogo!")}}
        postSubmitContent={<>Waiting on others to be done...</>} />
    </div>
  } else if (renderState.value === "Prompt") {
    return <Engine.Prompt onSubmit={(v: string) => {submit("Prompt", v)}} 
                          template={myTemplate.value} />
  } else if (renderState.value === "Lie") {
    if (currentGeneration.value) {
      return <>
        <Engine.Generation 
          generation={currentGeneration.value}
          skip={() => { message("GenerationError", "") }} />
        <Engine.Lie onSubmit={(v: string) => {submit("Lie", v)}} 
                    generation={currentGeneration.value}/>
      </>
    } else {
      return <p>Receiving prompts...</p>
    }
  } else if (renderState.value === "Vote" && currentGeneration.value) {
    if (genAuthor.value === user.uid ) {
      return <>
        <p>What did people think you said?</p>
        <ul>
          {voteOptions.value.map(o => {
            return <li class="HasUserText" key={o.uid}>{o.prompt}</li>
          })}
        </ul>
        <Engine.Generation generation={currentGeneration.value} />
      </>
    } else {
      return <>
        <Engine.Generation generation={currentGeneration.value} />
        <Engine.LieChoices onSubmit={(v: string) => {submit("Vote", v)}} options={voteOptions} />
      </>
    }
  } else if (renderState.value === "Score" && currentGeneration.value) {
    return <>
      <Engine.Scoreboard 
        options={voteOptions}
        gameState={props.gameState}
        players={props.players}
        onContinue={() => {message("ReadyToContinue", "")}} />
      <Engine.Generation generation={currentGeneration.value}
                        showPrompt={true} />
    </>
  } else if (renderState.value === "Finish") {
    return <>
      <p>You're all winners!</p>
      <Engine.Scoreboard 
        options={voteOptions}
        gameState={props.gameState}
        players={props.players} />
    </>
  } else {
    return <p>Congrats, you hit an unrecognized game state!</p>
  }
  
}
