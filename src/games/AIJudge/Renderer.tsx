import { h, Fragment } from "preact";
import { useContext } from "preact/hooks";
import { computed, useComputed, Signal, ReadonlySignal } from "@preact/signals";
import { Room, Message, State } from "../../../functions/src/games/aiJudge"
import { AuthContext } from "../../AuthProvider"
import TextOptions from "../../components/TextOptions";
import * as Engine from "./Engine";

import { messageRoom, updatePlayer } from "../../actions";
import SingleUseButton from "../../components/SingleUseButton";

export function Render(props: {
  room: Room & {id: string},
  gameState: Signal<Room["gameState"]>,
  players: Signal<Room["players"]>,
  isPlayer: boolean,
  isInputOnly: boolean,
}) {
  const { user } = useContext(AuthContext);
  if (!user) {
    throw new Error("User isn't defined in game renderer!");
  }
  
  const renderState:ReadonlySignal<State> = computed(() => {
    return (props.isPlayer && props.players.value)
      ? props.players.value[user.uid].state
      : props.gameState.value.state
  });
  const qAuthor = computed(() => props.gameState.value.currentQuestion)
  const qs = computed(() => props.gameState.value.questions)
  const currentQ = computed(() => (qAuthor.value && qs.value && qs.value[qAuthor.value]) ? qs.value[qAuthor.value] : null)
  const generation = computed(() => {
    const g = props.gameState.value.generations;
    return g ? g[Object.keys(g)[0]] : null;
  });
  
  const submit = (type: Message["type"], value: string) => {
    updatePlayer(props.room.id, { isReadyToContinue: true });
    message(type, value);
  }

  const message = (type: Message["type"], value: string) => {
    const m:Omit<Message, "uid"> = {
      type: type,
      value: value,
    }
    messageRoom(props.room.id, m);
  }
  
  
  if (renderState.value === "Lobby") {
    return <div class="PromptGuessLobby">
      <SingleUseButton 
        buttonText="Everybody's here!" 
        onClick={() => {message("Intro", "gogogo!")}}
        postSubmitContent={<>Go go go!</>} />
    </div>
  } else if (renderState.value === "Intro") {
    return <Engine.Intro introVideoUrl={props.room.definition.introVideo.url} />
  } else if (renderState.value === "Question") {
    return <>
      <Engine.Question 
        onSubmit={(v: string) => { submit("Question", v) }} />
    </>
  } else if (renderState.value === "Answer") {
    if (!currentQ.value) {
      throw new Error("Trying to render answer without a question");
    }
    return <Engine.Answer 
      onSubmit={(v: string) => {submit("Answer", v)}}
      question={currentQ.value} />
  } else if (renderState.value === "Vote" && generation.value) {
    const answers = Object.entries(generation.value.answers).sort(([_, v], [__, v2]) => {
      return v.letter > v2.letter ? 1 : -1;
    }).map(([uid, a]) => {
      return {uid, value: a.value}
    })
    return <>
      <p>{generation.value.question}</p>
      <TextOptions
        onSubmit={(v: string) => {submit("Vote", v)}}
        options={answers} />
    </>
  } else if (renderState.value === "Score" && generation.value) {
    return <>
      <Engine.Scoreboard 
        gameState={props.gameState}
        players={props.players}
        generation={generation.value}
        onContinue={() => {message("ReadyToContinue", "")}} />
    </>
  } else if (renderState.value === "Finish") {
    return <>
      <p>You're all winners!</p>
      <Engine.Scoreboard 
        gameState={props.gameState}
        players={props.players} />
    </>
  } else {
    return <p>Congrats, you hit an unrecognized game state!</p>
  }
  
}
