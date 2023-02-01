import { h, Fragment } from "preact";
import { useContext } from "preact/hooks";
import { AuthContext } from "../../AuthProvider";
import { PromptGeneration, PromptGuessRoom } from "../../../functions/src/games/promptGuessBase"
import SubmittableInput from "../../components/SubmittableInput";

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
  // TODO: include the generation too?
  return <>
  {authContext.user?.uid === props.generation.uid 
    ? <p>You are responsible for this masterpiece. Well done.</p>
    : <SubmittableInput
      onSubmit={props.onSubmit}
      label={props.generation.template.display}
      buttonText="Lie!" />
  }
  </>
};

function LieChoices(props: {
    onSubmit: (uid: string) => void,
    options: {uid: string, prompt: string}[]
  }) {
  const authContext = useContext(AuthContext);
  return <>
    {props.options.map((option) => {
      return <>
      {authContext.user?.uid !== option.uid
        ? <button key={option.uid} onClick={() => {
            props.onSubmit(option.uid);
          }}>{option.prompt}</button>
        : <button key={option.uid} disabled>{option.prompt}</button>
      }
      </>
    })}
  </>
};
  
function Generation(props: {generation: PromptGeneration, showPrompt?: boolean}) {
  return <>
    Unimplemented Generation renderer for {props.generation.model}.
    {props.showPrompt ? props.generation.prompt : ""}
  </>
};

// TODO: pass all of the vote data, players, render avatars, yadda yadda.
function Scoreboard(props: {
    scores: PromptGuessRoom["gameState"]["scores"]
  }) {
  return <>
    {Object.entries(props.scores).map(([k,v]) => {
      return <>
        <p>{k}: {v.current} {v.current !== v.previous ? `+${v.current-v.previous}` : ""}</p>
      </>
    })}
  </>
}

export {Intro, Prompt, Lie, LieChoices, Generation, Scoreboard}