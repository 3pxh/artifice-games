import { h, Fragment } from "preact";
import { useContext } from "preact/hooks";
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
      buttonText="Make it!" />
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
        buttonText="Lie!" />
    </div>
  }
};

function LieChoices(props: {
    onSubmit: (uid: string) => void,
    options: {uid: string, prompt: string}[]
  }) {
  const authContext = useContext(AuthContext);
  return <div class="PromptGuessBase-LieChoices">
    {props.options.map((option) => {
      return <>
      {authContext.user?.uid !== option.uid
        ? <button class="HasUserText" key={option.uid} onClick={() => {
            props.onSubmit(option.uid);
          }}>{option.prompt}</button>
        : <button class="HasUserText" key={option.uid} disabled>{option.prompt}</button>
      }
      </>
    })}
  </div>
};
  
function Generation(props: {generation: PromptGeneration, showPrompt?: boolean, delay?: number}) {
  return <>
    Unimplemented Generation renderer for {props.generation.model}.
    {props.showPrompt ? props.generation.prompt : ""}
  </>
};

// TODO: pass all of the vote data, players, render avatars, yadda yadda.
function Scoreboard(props: {
    scores: PromptGuessRoom["gameState"]["scores"],
    // players: PromptGuessRoom["players"],
    // votes:
    // generationAuthor: 
    onContinue?: () => void,
  }) {
  return <div class="PromptGuessBase-Scoreboard">
    {Object.entries(props.scores).map(([k,v]) => {
      return <>
        <p key={k}>{k}: {v.current} {v.current !== v.previous ? `+${v.current-v.previous}` : ""}</p>
      </>
    })}
    {props.onContinue 
      ? <SingleUseButton 
          buttonText="Continue" 
          onClick={props.onContinue} 
          postSubmitContent={<>Waiting on others to continue...</>} />
      : ''}
  </div>
}

export {Intro, Prompt, Lie, LieChoices, Generation, Scoreboard}