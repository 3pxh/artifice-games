import { h, Fragment, JSX, cloneElement } from "preact";
import { PromptGeneration } from "../../../functions/src/games/promptGuessBase";
import * as PromptGuessBase from "./PromptGuessBase";


export const Farsketched = {
  ...PromptGuessBase,
  Generation(props: {generation: PromptGeneration, showPrompt?: boolean}) {
    if (props.generation.error) {
      throw new Error(`Attempting to render Farsketched generation containing an error: ${props.generation.error}`)
    }

    if (props.generation.generation) {
      return <>
      {/* TODO: styling! */}
      {props.showPrompt ? <p>The truth was: <span class="PromptGuessGeneration-Truth">{props.generation.prompt}</span></p> : ""}
      <img key={props.generation.generation} src={props.generation.generation} class="PromptGuessGeneration-Image" />
    </>
    } else {
      return <>Waiting on the painting robot...</>
    }
  },
}

const RenderText = (props: {
  generation: PromptGeneration, 
  showPrompt?: boolean,
  textElement: JSX.Element,
}) => {
  if (props.generation.error) {
    throw new Error(`Attempting to render text generation containing an error: ${props.generation.error}`)
  } else if (!props.generation.generation) {
    return <>Waiting on the AI...</>
  } else {
    return <>
      <p>
        {props.generation.template.display}{' '}
        {props.showPrompt  ? <span class="PromptGuessGeneration-Truth HasUserText">{props.generation.prompt}</span> : "?"}
      </p>
      <span class="PromptGuessGeneration-Text HasUserText">
        {cloneElement(props.textElement, {}, [props.generation.generation.trim()])}
      </span>
    </>
  }
}

export const Gisticle = {
  ...PromptGuessBase,
  Generation(props: {generation: PromptGeneration, showPrompt?: boolean}) {
    return <>
      {/* TODO: styling! */}
      <RenderText 
        showPrompt={props.showPrompt}
        generation={props.generation}
        textElement={<span></span>} />
    </>
  },
}

export const Tresmojis = {
  ...PromptGuessBase,
  Generation(props: {generation: PromptGeneration, showPrompt?: boolean}) {
    return <>
      {/* TODO: styling! */}
      <RenderText 
        showPrompt={props.showPrompt}
        generation={props.generation} 
        textElement={<span style="font-size:48pt;"></span>} />
    </>
  },
}
