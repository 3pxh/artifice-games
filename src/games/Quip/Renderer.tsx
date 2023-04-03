import { h, Fragment } from "preact";
import { useContext } from "preact/hooks";
import { computed, Signal, ReadonlySignal } from "@preact/signals";
import * as Quip from "../../../functions/src/games/quip";
import { AuthContext } from "../../AuthProvider";
import { messageRoom, setScratchpad, updatePlayer } from "../../actions";
import SingleUseButton from "../../components/SingleUseButton";
import SubmittableInput from "../../components/SubmittableInput";

export function RenderQuip(props: {
  room: Quip.Room & {id: string},
  gameState: Signal<Quip.Room["gameState"]>,
  players: Signal<Quip.Room["players"]>,
  scratchpad: Signal<{input: string} | null>,
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
  const scratchpad = computed(() => props.scratchpad.value?.input ?? "");
  const generation = computed(() => {
    const g = props.gameState.value.generations;
    return g ? g[Object.keys(g)[0]] : null;
  });
  const quips = computed(() => props.gameState.value.quips);
  const currentPlayer = computed(() => props.gameState.value.currentPlayer);
  
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
    return <>
      <h2>About this game:</h2>
      <p>{props.room.definition.description}</p>
      <div class="PromptGuessLobby">
        <SingleUseButton 
          key="LobbyContinue"
          buttonText="Ready to start!"
          hasBeenUsed={isReadyToContinue.value}
          onClick={() => {message("ReadyToContinue", "gogogo!")}}
          postSubmitContent={<>The game will start once everyone's ready.</>} />
      </div>
    </>
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
    if (currentPlayer.value === user.uid) {
      return <SubmittableInput
        key="QuestionInput"
        onSubmit={(v: string) => {submit("Input", v)}}
        onChange={(v: string) => {setScratchpad(props.room.id, {input: v})}}
        label={roundPrompt.value}
        submittedValue={myQuip.value}
        placeholder=""
        buttonText="So original!"
        postSubmitMessage="Waiting on other players..."
        maxLength={80} />
    } else {
      return<>
        <p>{roundPrompt.value}</p>
        <p>{props.players.value[currentPlayer.value].handle}: {scratchpad.value}</p>
      </>
    }
  } else if (renderState.value === "Response" && quips.value) {
    if (!generation.value) {
      throw new Error("Trying to render response without generation");
    }
    const g = generation.value as Quip.Generation;
    if (g.fulfilled) {
      return <>
        <p>{roundPrompt.value}</p>
        <p>Answer: {quips.value[currentPlayer.value]}</p>
        <p>Points: {g.generation.points}</p>
        <p>{g.generation.comment ?? "I could not comment on that."}</p>
        <SingleUseButton 
          key="ShowResultsContinue"
          buttonText="Ready to continue" 
          hasBeenUsed={isReadyToContinue.value}
          onClick={() => {message("ReadyToContinue", "gogogo!")}}
          postSubmitContent={<>Waiting on others to be done...</>} />
      </>
    } else {
      return <p>Waiting for the AI to pass judgment...</p>
    }
    
  } else if (renderState.value === "Score" && generation.value) {
    // TODO #async: check if they're ready to continue, don't render button
    return <>
      <p>Leaderboard</p>
      {Object.entries(props.players.value).map(([uid, v]) => {
        if (!v.isPlayer) { return <></> }
        return <p>
          {v.handle}: {props.gameState.value.scores![uid].current}
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
