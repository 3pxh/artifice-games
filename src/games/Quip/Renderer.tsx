import { h, Fragment } from "preact";
import { useContext } from "preact/hooks";
import { computed, Signal, ReadonlySignal } from "@preact/signals";
import * as Quip from "../../../functions/src/games/quip";
import { AuthContext } from "../../AuthProvider";
import { messageRoom, updatePlayer } from "../../actions";
import SingleUseButton from "../../components/SingleUseButton";
import SubmittableInput from "../../components/SubmittableInput";

export function RenderQuip(props: {
  room: Quip.Room & {id: string},
  gameState: Signal<Quip.Room["gameState"]>,
  players: Signal<Quip.Room["players"]>,
  isPlayer: boolean,
  isInputOnly: boolean,
}) {
  const { user } = useContext(AuthContext);
  if (!user) {
    throw new Error("User isn't defined in game renderer!");
  }
  
  const renderState:ReadonlySignal<Quip.State> = computed(() => {
    return (props.isPlayer && props.players.value)
      ? props.players.value[user.uid].state
      : props.gameState.value.state
  });
  const roundPrompt = computed(() => props.gameState.value.roundPrompt)
  const generation = computed(() => {
    const g = props.gameState.value.generations;
    return g ? g[Object.keys(g)[0]] : null;
  });
  const quips = computed(() => props.gameState.value.quips);
  
  const submit = (type: Quip.Message["type"], value: string) => {
    updatePlayer(props.room.id, { isReadyToContinue: true });
    message(type, value);
  }

  const message = (type: Quip.Message["type"], value: string) => {
    const m:Omit<Quip.Message, "uid"> = {
      type: type,
      value: value,
    }
    messageRoom(props.room.id, m);
  }

  /* Signals for asynchronous loads */
  const isReadyToContinue = computed(() => {
    return props.players.value[user.uid].isReadyToContinue;
  });
  const myQuip = computed(() => {
    return quips.value ? (quips.value[user.uid] ?? undefined) : undefined;
  });
  /* End signals for asynchronous loads */
  
  if (renderState.value === "Lobby") {
    // TODO: don't show the button unless they have a name and avatar.
    return <div class="PromptGuessLobby">
      <SingleUseButton 
        key="LobbyContinue"
        buttonText="Ready to start!"
        hasBeenUsed={isReadyToContinue.value}
        onClick={() => {message("ReadyToContinue", "gogogo!")}}
        postSubmitContent={<>The game will start once everyone's ready.</>} />
    </div>
  } else if (renderState.value === "Intro") {
    // TODO #async: check if they already hit the button.
    // i.e. are they ReadyToContinue?
    return <div>
      {props.room.definition.introVideo.url 
        ? <iframe class="YoutubeEmbed" src={`${props.room.definition.introVideo.url}?autoplay=1`}></iframe>
        : "Instruction video not found."}
      <SingleUseButton 
        key="IntroContinue"
        buttonText="Done watching" 
        hasBeenUsed={isReadyToContinue.value}
        onClick={() => {message("ReadyToContinue", "gogogo!")}}
        postSubmitContent={<>Waiting on others to be done...</>} />
    </div>
  } else if (renderState.value === "Input") {
    // TODO #async: we need to check if there's already a question by them, and display it if so.
    return <SubmittableInput
      key="QuestionInput"
      onSubmit={(v: string) => {submit("Input", v)}}
      label={roundPrompt.value}
      submittedValue={myQuip.value}
      placeholder=""
      buttonText="So original!"
      postSubmitMessage="Waiting on other players..."
      maxLength={80} />
  } else if (renderState.value === "ShowResults") {
    if (!generation.value) {
      throw new Error("Trying to render answer without a question");
    }
    const g = generation.value.generation as Quip.GenerationSchema;
    return <>
      <p>{roundPrompt.value}</p>
      <p>Winner: {g.better}</p>
      <p>Why? {g.reason}</p>
      <SingleUseButton 
        key="ShowResultsContinue"
        buttonText="Ready to continue" 
        hasBeenUsed={isReadyToContinue.value}
        onClick={() => {message("ReadyToContinue", "gogogo!")}}
        postSubmitContent={<>Waiting on others to be done...</>} />
    </>
  } else if (renderState.value === "Score" && generation.value) {
    // TODO #async: check if they're ready to continue, don't render button
    return <>
      <p>{roundPrompt.value}</p>
      {Object.entries(props.players.value).map(([uid, v]) => {
        if (!v.isPlayer) { return <></> }
        return <p>
          {v.handle}: {props.gameState.value.scores![uid]}
        </p>
      })}
      <SingleUseButton 
        key="ScoresContinue"
        buttonText="Ready to continue" 
        hasBeenUsed={isReadyToContinue.value}
        onClick={() => {message("ReadyToContinue", "gogogo!")}}
        postSubmitContent={<>Waiting on others to be done...</>} />
    </>
  } else if (renderState.value === "Finish") {
    return <>
      <p>You're all winners!</p>
    </>
  } else {
    return <p>Congrats, you hit an unrecognized game state!</p>
  }
}
