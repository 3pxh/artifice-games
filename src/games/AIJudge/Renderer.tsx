import { h, Fragment } from "preact";
import { useContext } from "preact/hooks";
import { computed, Signal, ReadonlySignal } from "@preact/signals";
import * as Judge from "../../../functions/src/games/aiJudge";
import { JudgeUtils } from "../../../functions/src/utils";
import { AuthContext } from "../../AuthProvider";
import { messageRoom, updatePlayer } from "../../actions";
import { TextOptions, ScoredTextOptions } from "../../components/TextOptions";
import SingleUseButton from "../../components/SingleUseButton";
import SubmittableInput from "../../components/SubmittableInput";

export function RenderAIJudge(props: {
  room: Judge.Room & {id: string},
  gameState: Signal<Judge.Room["gameState"]>,
  players: Signal<Judge.Room["players"]>,
  isPlayer: boolean,
  isInputOnly: boolean,
}) {
  const { user } = useContext(AuthContext);
  if (!user) {
    throw new Error("User isn't defined in game renderer!");
  }
  
  const renderState:ReadonlySignal<Judge.State> = computed(() => {
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
  const answers = computed(() => {
    if (!generation.value) { 
      return []; 
    } else {
      return Object.entries(generation.value.answers).sort(([_, v], [__, v2]) => {
        return v.letter > v2.letter ? 1 : -1;
      }).map(([uid, a]) => {
        return {uid, value: a.value}
      })
    }
  });
  const aiChoiceUid = computed(() => {
    if (generation.value) {
      return JudgeUtils.choiceUid(generation.value) ?? "";
    }
    return "";
  });
  
  const submit = (type: Judge.Message["type"], value: string) => {
    updatePlayer(props.room.id, { isReadyToContinue: true });
    message(type, value);
  }

  const message = (type: Judge.Message["type"], value: string) => {
    const m:Omit<Judge.Message, "uid"> = {
      type: type,
      value: value,
    }
    messageRoom(props.room.id, m);
  }
  
  if (renderState.value === "Lobby") {
    return <div class="PromptGuessLobby">
      <SingleUseButton 
        key="LobbyContinue"
        buttonText="Ready to start!"
        onClick={() => {message("ReadyToContinue", "gogogo!")}}
        postSubmitContent={<>The game will start once everyone's ready.</>} />
    </div>
  } else if (renderState.value === "Intro") {
    return <div>
      <iframe class="YoutubeEmbed" src={`${props.room.definition.introVideo.url}?autoplay=1`}></iframe>
      <SingleUseButton 
        key="IntroContinue"
        buttonText="Done watching" 
        onClick={() => {message("ReadyToContinue", "gogogo!")}}
        postSubmitContent={<>Waiting on others to be done...</>} />
    </div>
  } else if (renderState.value === "Question") {
    return <SubmittableInput
      key="QuestionInput"
      onSubmit={(v: string) => {submit("Question", v)}}
      label="Write a question to quiz the AI!"
      placeholder=""
      buttonText="So original!"
      postSubmitMessage="Waiting on other players..."
      maxLength={80} />
  } else if (renderState.value === "Answer") {
    if (!currentQ.value) {
      throw new Error("Trying to render answer without a question");
    }
    return <SubmittableInput 
      key="AnswerInput"
      onSubmit={(v: string) => {submit("Answer", v)}} 
      label={currentQ.value}
      placeholder="write a great answer to get chosen"
      buttonText="That's a good one!" 
      postSubmitMessage="Waiting on other players..."
      maxLength={80} />
  } else if (renderState.value === "Vote" && generation.value) {
    return <>
      <p>{currentQ.value}</p>
      <TextOptions
        key="VoteOptions"
        onSubmit={(v: string) => {submit("Vote", v)}}
        options={answers.value} />
    </>
  } else if (renderState.value === "Score" && generation.value) {
    return <>
      <p>{currentQ.value}</p>
      <ScoredTextOptions
        key="ScoreOptions"
        options={answers.value}
        correctUid={aiChoiceUid.value}
        players={props.players}
        votes={props.gameState.value.votes!}
        scores={props.gameState.value.scores!}
        pointValues={JudgeUtils.pointValues}
        onContinue={() => { message("ReadyToContinue", "") }} />
    </>
  } else if (renderState.value === "Finish") {
    return <>
      <p>You're all winners!</p>
    </>
  } else {
    return <p>Congrats, you hit an unrecognized game state!</p>
  }
}
