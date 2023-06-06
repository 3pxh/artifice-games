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

  /* Signals for asynchronous loads */
  const isReadyToContinue = computed(() => {
    return props.players.value[user.uid].isReadyToContinue;
  });
  const myQuestion = computed(() => {
    return qs.value ? (qs.value[user.uid] ?? undefined) : undefined;
  });
  const myAnswer = computed(() => {
    const answers = props.gameState.value.answers;
    return answers ? (answers[user.uid] ?? undefined) : undefined;
  });
  const myVote = computed(() => {
    return props.gameState.value.votes ? (props.gameState.value.votes[user.uid] ?? undefined) : undefined;
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
  } else if (renderState.value === "Question") {
    // TODO #async: we need to check if there's already a question by them, and display it if so.
    return <SubmittableInput
      key="QuestionInput"
      onSubmit={(v: string) => {submit("Question", v)}}
      label="Write a question to quiz the AI!"
      submittedValue={myQuestion.value}
      placeholder=""
      buttonText="So original!"
      postSubmitMessage="Waiting on other players..."
      maxLength={80} />
  } else if (renderState.value === "Answer") {
    if (!currentQ.value) {
      throw new Error("Trying to render answer without a question");
    }
    // TODO #async: check if they've already answered
    return <>
      <p>Write an answer the AI will pick for the question:</p>
      <SubmittableInput 
        key="AnswerInput"
        onSubmit={(v: string) => {submit("Answer", v)}} 
        label={currentQ.value}
        submittedValue={myAnswer.value}
        placeholder="write your answer"
        buttonText="submit" 
        postSubmitMessage="Waiting on other players..."
        maxLength={80} />
    </>
  } else if (renderState.value === "Vote" && generation.value) {
    // TODO #async: show their vote if they already voted
    return <>
      <p>Which answer will the AI pick to the question:</p>
      <>{currentQ.value}</>
      <TextOptions
        key="VoteOptions"
        voteValue={myVote.value}
        onSubmit={(v: string) => {submit("Vote", v)}}
        options={answers.value} />
    </>
  } else if (renderState.value === "Score" && generation.value) {
    // TODO #async: check if they're ready to continue, don't render button
    return <>
      <p>Here's what the AI picked to answer:</p>
      <>{currentQ.value}</>
      <ScoredTextOptions
        key="ScoreOptions"
        options={answers.value}
        correctUid={aiChoiceUid.value}
        players={props.players}
        votes={props.gameState.value.votes!}
        scores={props.gameState.value.scores!}
        pointValues={JudgeUtils.pointValues}
        hasBeenContinued={isReadyToContinue.value}
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
