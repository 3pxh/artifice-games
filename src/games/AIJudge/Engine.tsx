import { h, Fragment } from "preact";
import { useContext, useState } from "preact/hooks";
import { Signal, useComputed } from "@preact/signals";
import { shuffle, seed32bit, objectMap } from "../../../functions/src/utils";
import { Generation, Room, GameDefinition } from "../../../functions/src/games/aiJudge"
import { AuthContext } from "../../AuthProvider";
import SubmittableInput from "../../components/SubmittableInput";
import SingleUseButton from "../../components/SingleUseButton";

function Intro(props: {introVideoUrl?: string}) {
  return <p>Play intro video: {props.introVideoUrl ?? "video not found for this game"}</p>
};

function Category(props: {onSubmit?: string}) {
  return <p></p>
};

function Answer(props: {
    onSubmit: (prompt: string) => void,
    category: string,
  }) {
  return <div class="Prompt-Hero">
    <SubmittableInput 
      onSubmit={props.onSubmit} 
      label={`Enter a ${props.category}`} 
      buttonText="That's a good one!" 
      postSubmitMessage="Waiting on other players..." />
  </div>
};
  
function Question(props: {
    onSubmit: (prompt: string) => void,
    category: string
  }) {
  const authContext = useContext(AuthContext);
  return <div class="Prompt-Hero">
    <SubmittableInput
      onSubmit={props.onSubmit}
      label={`Which ${props.category}...`}
      placeholder="(write a question)"
      buttonText="So original!"
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
    const text = props.generation.generation.trim().toUpperCase().charAt(0); // This trim and upper should happen serverside yes?
    const answers = Object.entries(props.generation.answers).sort(([_, v], [__, v2]) => {
      return v.letter > v2.letter ? 1 : -1;
    })
    return <>
      <p>
        {/* TODO: do we want to include the game definition's questionPreface? */}
        {`Which ${props.generation.category} ${props.generation.question}?`}
      </p>
      <p class="PromptGuessGeneration-Text HasUserText">
        {answers.map(([u, v]) => {
          return <button onClick={() => { props.onVote ? props.onVote(u) : "" }} disabled={!props.onVote}>
            {`${v.letter}) ${v.value} ${v.letter === text ? " - pick!" : " - not pick"}`}
          </button>
        })}
      </p>
      <span>
        {props.onVote ? "" : text}
      </span>
    </>
  }
}

function Scoreboard(props: {
  gameState: Signal<Room["gameState"]>,
  players: Signal<Room["players"]>,
  onContinue?: () => void,
}) {
  // const playerData = useComputed(() => {
  //   const scores = props.gameState.value.scores ?? {};
  //   return objectMap<Room["players"]["uid"], {avatar?: string, handle?: string} & {current: number, previous: number}>(
  //     props.players.value, 
  //     (p, uid) => {return {avatar: p.avatar, handle: p.handle, ...scores[uid]}})
  // });
  // const votes = useComputed(() => props.gameState.value.votes);
  // const creator = useComputed(() => props.gameState.value.currentGeneration);

  return <div>
    <h2>Scores</h2>
    {props.onContinue 
      ? <SingleUseButton 
          buttonText="Ready to continue!" 
          onClick={props.onContinue} 
          postSubmitContent={<>Waiting on others to continue...</>} />
      : ''}
  </div>
}

export {Intro, Answer, Question, Judgment, Scoreboard}