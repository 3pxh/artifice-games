import { h, Fragment } from "preact";
import { useContext, useState } from "preact/hooks";
import { Signal, useComputed } from "@preact/signals";
import { shuffle, seed32bit, objectMap } from "../../../functions/src/utils";
import { AuthContext } from "../../AuthProvider";
import { PromptGeneration, PromptGuessRoom } from "../../../functions/src/games/promptGuessBase"
import SubmittableInput from "../../components/SubmittableInput";
import SingleUseButton from "../../components/SingleUseButton";

function Intro(props: {introVideoUrl?: string}) {
  return <p>Play intro video: {props.introVideoUrl ?? "video not found for this game"}</p>
};

function Prompt(props: {
    onSubmit: (prompt: string) => void,
    template: {display: string},
  }) {
  return <div class="Prompt-Hero">
    <SubmittableInput 
      onSubmit={props.onSubmit} 
      label={props.template.display} 
      buttonText="Make it!" 
      postSubmitMessage="Waiting on other players..." />
  </div>
};
  
function Lie(props: {
    onSubmit: (prompt: string) => void,
    generation: PromptGeneration,
  }) {
  const authContext = useContext(AuthContext);
  if (!props.generation.fulfilled) {
    // Generations are responsible for showing loading state.
    return <></>
  } else if (authContext.user?.uid === props.generation.uid) {
    return <p>You are responsible for this masterpiece. Well done.</p>
  } else {
    return <div class="Prompt-Hero">
      <SubmittableInput
        onSubmit={props.onSubmit}
        label="Fool others with some artifice:"
        buttonText="Lie!"
        postSubmitMessage="Waiting on other players..." />
    </div>
  }
};

function LieChoices(props: {
  onSubmit: (uid: string) => void,
  options: Signal<{uid: string, prompt: string}[]>
}) {
  // We need a stable shuffle or anytime this rerenders it moves them.
  const [seed, _] = useState(seed32bit());
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [vote, setVote] = useState("");
  

  const authContext = useContext(AuthContext);
  return <div class="PromptGuessBase-LieChoices">
    {shuffle(props.options.value, seed).map((option) => {
      return <button 
        class={"HasUserText " + (vote === option.uid ? "Picked" : "")}
        key={option.uid} 
        onClick={() => {
          setHasSubmitted(true);
          setVote(option.uid);
          props.onSubmit(option.uid);
        }} disabled={hasSubmitted || authContext.user?.uid === option.uid}>{option.prompt}</button>
    })}
  </div>
};
  
function Generation(props: {generation: PromptGeneration, showPrompt?: boolean, delay?: number}) {
  return <>
    Unimplemented Generation renderer for {props.generation.model}.
    {props.showPrompt ? props.generation.prompt : ""}
  </>
};

function Scoreboard(props: {
  gameState: Signal<PromptGuessRoom["gameState"]>,
  players: Signal<PromptGuessRoom["players"]>,
  options: Signal<{uid: string, prompt: string}[]>,
  onContinue?: () => void,
}) {
  const playerData = useComputed(() => {
    const scores = props.gameState.value.scores;
    return objectMap<PromptGuessRoom["players"]["uid"], {avatar?: string, handle?: string} & PromptGuessRoom["gameState"]["scores"]["uid"]>(
      props.players.value, 
      (p, uid) => {return {avatar: p.avatar, handle: p.handle, ...scores[uid]}})
  });
  const votes = useComputed(() => props.gameState.value.votes);
  const creator = useComputed(() => props.gameState.value.currentGeneration);
  
  if (!votes.value) {
    return <>Trying to render scoreboard without votes.</>
  } else {
    return <div class="PromptGuessBase-Scoreboard">
      {props.options.value.map(o => {
        const isTruth = o.uid === creator.value;
        return <div class={"PromptGuessBase-Score " + (isTruth ? "Truth" : "Lie")}>
          <img src={playerData.value[o.uid].avatar} class="Avatar PromptGuessBase-ScoreCreator" width="48" height="48" />
          <div class="PromptGuessBase-ScorePrompt">{o.prompt}</div>
          {Object.entries(votes.value!).map(([voter, vote]) => {
            if (vote === o.uid) {
              return <img src={playerData.value[voter].avatar} class="Avatar" width="32" height="32" />
            }
          })}
        </div>
      })}
      {/* This is more of a leaderboard, and we might want to show it persistently. */}
      <div class="PromptGuessBase-Leaderboard">
        <p>Leaderboard:</p>
        {Object.entries(playerData.value).sort(([_, p1], [__, p2]) => p2.current - p1.current).map(([k,v], i) => {
          return <div key={k} class="PromptGuessBase-LeaderboardScore">
            <span class="PromptGuessBase-LeaderboardRank">{i+1}.</span>
            <img src={v.avatar} class="Avatar" width="32" />
            {v.handle}:{" "}
            {v.current}{" "}
            {v.current !== v.previous ? <small style="margin-left:10px;">{`(+${v.current-v.previous})`}</small> : ""}
          </div>
        })}
      </div>
      {props.onContinue 
        ? <SingleUseButton 
            buttonText="Ready to continue!" 
            onClick={props.onContinue} 
            postSubmitContent={<>Waiting on others to continue...</>} />
        : ''}
    </div>
  }
}

export {Intro, Prompt, Lie, LieChoices, Generation, Scoreboard}