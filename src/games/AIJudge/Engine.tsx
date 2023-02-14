import { h, Fragment } from "preact";
import { useContext } from "preact/hooks";
import { Signal, useComputed } from "@preact/signals";
import { objectMap } from "../../../functions/src/utils";
import { Generation, Room, GameDefinition, GetAIChoice } from "../../../functions/src/games/aiJudge"
import { AuthContext } from "../../AuthProvider";
import SubmittableInput from "../../components/SubmittableInput";
import SingleUseButton from "../../components/SingleUseButton";

function Intro(props: {introVideoUrl?: string}) {
  return <p>Play intro video: {props.introVideoUrl ?? "video not found for this game"}</p>
};

function Question(props: {
    onSubmit: (prompt: string) => void,
  }) {
  const authContext = useContext(AuthContext);
  return <div class="Prompt-Hero">
    <SubmittableInput
      onSubmit={props.onSubmit}
      label="Write a question to ask the AI for judgement 🧑‍⚖️"
      placeholder=""
      buttonText="So original!"
      postSubmitMessage="Waiting on other players..." />
  </div>
};

function Answer(props: {
  onSubmit: (prompt: string) => void,
  question: string,
}) {
return <div class="Prompt-Hero">
  <SubmittableInput 
    onSubmit={props.onSubmit} 
    label={props.question}
    placeholder="write a great answer"
    buttonText="That's a good one!" 
    postSubmitMessage="Waiting on other players..." />
</div>
};


function Judgment(props: {
  onVote?: (v: string) => void,
  questionPreface: GameDefinition["questionPreface"],
  generation: Generation, 
}) {
  if (!props.generation.generation) {
    return <>Waiting on the AI...</>
  } else {
    const text = GetAIChoice(props.generation);
    const answers = Object.entries(props.generation.answers).sort(([_, v], [__, v2]) => {
      return v.letter > v2.letter ? 1 : -1;
    })
    return <>
      <p>
        {/* TODO: do we want to include the game definition's questionPreface? */}
        {`Which one... ${props.generation.question}?`}
      </p>
      <div class="HasUserText">
        {answers.map(([u, v]) => {
          return <button class="HasUserText" onClick={() => { props.onVote ? props.onVote(u) : "" }} disabled={!props.onVote}>
            {`${v.letter}) ${v.value} ${v.letter === text ? " - pick!" : " - not pick"}`}
          </button>
        })}
      </div>
      <span>
        {props.onVote ? "" : text}
      </span>
    </>
  }
}

function Scoreboard(props: {
  gameState: Signal<Room["gameState"]>,
  players: Signal<Room["players"]>,
  generation?: Generation | null,
  onContinue?: () => void,
}) {
  const playerData = useComputed(() => {
    const scores = props.gameState.value.scores ?? {};
    return objectMap<Room["players"]["uid"], {avatar?: string, handle?: string} & {current: number, previous: number}>(
      props.players.value, 
      (p, uid) => {return {avatar: p.avatar, handle: p.handle, ...scores[uid]}})
  });
  const votes = useComputed(() => props.gameState.value.votes);

  return <div>
    <h2>Scores</h2>
    {props.onContinue 
      ? <SingleUseButton 
          buttonText="Ready to continue!" 
          onClick={props.onContinue} 
          postSubmitContent={<>Waiting on others to continue...</>} />
      : ''}
    {JSON.stringify(playerData.value)}
  </div>
}

export {Intro, Answer, Question, Judgment, Scoreboard}