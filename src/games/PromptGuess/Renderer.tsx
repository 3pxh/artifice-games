import { h, Fragment } from "preact";
import { useContext } from "preact/hooks";
import { computed, useComputed, Signal, ReadonlySignal } from "@preact/signals";
import { PromptGuessMessage, PromptGuessRoom, PromptGuessState, PromptGeneration } from "../../../functions/src/games/promptGuessBase"
import { AuthContext } from "../../AuthProvider"
import { messageRoom, updatePlayer } from "../../actions";
import { RoomData } from "../../Room";
import SingleUseButton from "../../components/SingleUseButton";
import SubmittableInput from "../../components/SubmittableInput";
import { ScoredTextOptions, TextOptions } from "../../components/TextOptions";
import { PGUtils } from "../../../functions/src/utils";


function ImageGeneration(props: {generation: PromptGeneration, showPrompt?: boolean}) {
  if (props.generation.generation) {
    return <>
    {props.showPrompt ? <p>The truth was: <span class="PromptGuessGeneration-Truth">{props.generation.prompt}</span></p> : ""}
    <img key={props.generation.generation} src={props.generation.generation} class="PromptGuessGeneration-Image" />
  </>
  } else {
    return <>Waiting on the painting robot...</>
  }
}
function TextGeneration(props: {
  generation: PromptGeneration, 
  showPrompt?: boolean,
}) {
  if (!props.generation.generation) {
    return <>Waiting on the AI...</>
  } else {
    const text = props.generation.generation.trim();
    // Currently just for tresmojis.
    const fontStyle = text.length < 10 ? "font-size: 48pt;" : "";
    return <>
      <p>
        {props.generation.template.display}{' '}
        {props.showPrompt  ? <span class="PromptGuessGeneration-Truth HasUserText">{props.generation.prompt}</span> : "?"}
      </p>
      <span class="PromptGuessGeneration-Text HasUserText" style={fontStyle}>
        {text}
      </span>
    </>
  }
}
  
function Generation(props: {
  generation: PromptGeneration,
  skip?: () => void,
  showPrompt?: boolean, 
  delay?: number
}) {
  if (props.generation.error && props.skip) {
    return <>
      <p>Oh no! The AI hit an error: {props.generation.error}</p>
      <p>The prompt was: {props.generation.prompt}</p>
      <SingleUseButton
        buttonText="Skip to next"
        postSubmitContent={<>Skipping...</>}
        onClick={props.skip} />
    </>
  }
  if (props.generation.model.name === "StableDiffusion") {
    return <ImageGeneration generation={props.generation} showPrompt={props.showPrompt} />
  } else if (props.generation.model.name === "GPT3") {
    return <TextGeneration generation={props.generation} showPrompt={props.showPrompt} />
  } else {
    return <>Renderer not implemented for that model type.</>
  }
};

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
        value: prompt
      }
    });
    return s;
  })
  
  /* Signals for asynchronous loads */
  const isReadyToContinue = computed(() => {
    return props.players.value[user.uid].isReadyToContinue;
  });
  const myPrompt = computed(() => {
    const gens = props.gameState.value.generations;
    return (gens && gens[user.uid]) ? gens[user.uid].prompt : undefined;
  });
  const myLie = computed(() => {
    const lies = props.gameState.value.lies;
    if (props.gameState.value.currentGeneration === user.uid) {
      return "You are responsible for this masterpiece."
    } else {
      return (lies && lies[user.uid]) ? `You put: ${lies[user.uid]}` : undefined;
    }
  });
  const myVote = computed(() => {
    return props.gameState.value.votes ? (props.gameState.value.votes[user.uid] ?? undefined) : undefined;
  });
  /* End signals for asynchronous loads */

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
    return <SubmittableInput
      key="PromptInput"
      onSubmit={(v: string) => {submit("Prompt", v)}}
      label={myTemplate.value.display}
      submittedValue={myPrompt.value}
      placeholder=""
      buttonText="Very funny!"
      postSubmitMessage="Waiting on other players..."
      maxLength={80} />
  } else if (renderState.value === "Lie") {
    if (currentGeneration.value) {
      return <>
        <Generation
          key="LieGeneration"
          generation={currentGeneration.value}
          skip={() => { message("GenerationError", "") }} />
        {currentGeneration.value.fulfilled
          ? <SubmittableInput
            key="LieInput"
            onSubmit={(v: string) => {submit("Lie", v)}}
            submittedValue={myLie.value}
            label={myLie.value ? "" : "Fool others with some artifice:"}
            buttonText="Lie!"
            postSubmitMessage="Waiting on other players..."
            maxLength={70} />
          : ""}
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
            return <li class="HasUserText" key={o.uid}>{o.value}</li>
          })}
        </ul>
        <Generation generation={currentGeneration.value} />
      </>
    } else {
      return <>
        <Generation generation={currentGeneration.value} />
        <TextOptions
          key="VoteOptions" 
          disableUserOption={true}
          onSubmit={(v: string) => {submit("Vote", v)}} 
          voteValue={myVote.value}
          shuffle={true}
          options={voteOptions.value} />
      </>
    }
  } else if (renderState.value === "Score" && currentGeneration.value) {
    return <>
      <Generation 
        generation={currentGeneration.value}
        showPrompt={true} />
      <ScoredTextOptions
        options={voteOptions.value}
        correctUid={currentGeneration.value.uid}
        players={props.players}
        votes={props.gameState.value.votes ?? {}}
        scores={props.gameState.value.scores ?? {}}
        pointValues={PGUtils.pointValues}
        hasBeenContinued={isReadyToContinue.value}
        onContinue={() => {message("ReadyToContinue", "")}} />
    </>
  } else if (renderState.value === "Finish") {
    return <>
      <p>You're all winners!</p>
    </>
  } else {
    return <p>Congrats, you hit an unrecognized game state!</p>
  }
  
}
