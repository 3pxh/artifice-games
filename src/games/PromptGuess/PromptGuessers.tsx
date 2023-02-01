import { h, Fragment } from "preact";
import { PromptGeneration } from "../../../functions/src/games/promptGuessBase";
import * as PromptGuessBase from "./PromptGuessBase";

export const Farsketched = {
  ...PromptGuessBase,
  Generation(props: {generation: PromptGeneration, showPrompt?: boolean}) {
    if (props.generation.error) {
      throw new Error(`Attempting to render Farsketched generation containing an error: ${props.generation.error}`)
    } else if (!props.generation.value.includes("http")) {
      return <>{props.generation.value}</>
      // TODO: Throw this error. This is currently useful for debugging while
      // we haven't actually made a URL for the image, which might take
      // some doing with access control, buckets, etc.
      // throw new Error(`Farsketched generation is not a url: ${props.generation.value}`)
    }
    return <>
      {/* TODO: styling! */}
      {props.showPrompt ? props.generation.prompt : ""}
      <img src={props.generation.value} width="512" />
    </>
  },
}

const RenderText = (props: {generation: PromptGeneration}) => {
  if (props.generation.error) {
    throw new Error(`Attempting to render text generation containing an error: ${props.generation.error}`)
  }
  return <>
    {props.generation.value}
  </>
}

export const Gisticle = {
  ...PromptGuessBase,
  Generation(props: {generation: PromptGeneration, showPrompt?: boolean}) {
    return <>
      {/* TODO: styling! */}
      <p><RenderText generation={props.generation} /></p>
      {props.showPrompt ? props.generation.prompt : ""}
    </>
  },
}

export const Tresmojis = {
  ...PromptGuessBase,
  Generation(props: {generation: PromptGeneration, showPrompt?: boolean}) {
    return <>
      {/* TODO: styling! */}
      <p><RenderText generation={props.generation} /></p>
      {props.showPrompt ? props.generation.prompt : ""}
    </>
  },
}
