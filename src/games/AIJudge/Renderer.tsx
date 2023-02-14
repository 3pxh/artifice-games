import { h, Fragment } from "preact";
import { useContext } from "preact/hooks";
import { computed, useComputed, Signal, ReadonlySignal } from "@preact/signals";
import { Room, Message, State } from "../../../functions/src/games/aiJudge"
import { AuthContext } from "../../AuthProvider"
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
  const genAuthor = computed(() => props.gameState.value.currentGeneration)
  const gens = computed(() => props.gameState.value.generations)
  const currentGeneration = computed(() => genAuthor.value && gens.value && gens.value[genAuthor.value] ? gens.value[genAuthor.value] : null)
  const category = computed(() => props.gameState.value.category);
  
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
  } else if (renderState.value === "Answer") {
    return <Engine.Answer 
      onSubmit={(v: string) => {submit("Answer", v)}}
      category={category.value} />
  } else if (renderState.value === "Question") {
    return <>
      <Engine.Question 
        onSubmit={(v: string) => { submit("Question", v) }}
        category={category.value} />
    </>
  } else if (renderState.value === "Vote" && currentGeneration.value) {
    return <>
      <Engine.Judgment 
        onVote={(v: string) => {submit("Vote", v)}}
        questionPreface={props.room.definition.questionPreface}
        generation={currentGeneration.value} />
    </>
  } else if (renderState.value === "Score" && currentGeneration.value) {
    return <>
      <Engine.Scoreboard 
        gameState={props.gameState}
        players={props.players}
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
