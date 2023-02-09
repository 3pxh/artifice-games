import { h, Fragment } from "preact";
import { useEffect, useState } from "preact/hooks";
import { ref, getDownloadURL } from "@firebase/storage";
import { storage } from "../../firebaseClient";

import { PromptGeneration } from "../../../functions/src/games/promptGuessBase";
import * as PromptGuessBase from "./PromptGuessBase";


export const Farsketched = {
  ...PromptGuessBase,
  Generation(props: {generation: PromptGeneration, showPrompt?: boolean}) {
    if (props.generation.error) {
      throw new Error(`Attempting to render Farsketched generation containing an error: ${props.generation.error}`)
    }

    return <>
      {/* TODO: styling! */}
      {props.showPrompt ? <p>The truth was: <span class="Generation-Truth">{props.generation.prompt}</span></p> : ""}
      <img key={props.generation.generation} src={props.generation.generation} class="Generation-Image" />
    </>
  },
}

const RenderText = (props: {generation: PromptGeneration, showPrompt?: boolean}) => {
  if (props.generation.error) {
    throw new Error(`Attempting to render text generation containing an error: ${props.generation.error}`)
  } else if (!props.generation.generation) {
    return <>Waiting on the AI...</>
  } else {
    return <>
      {props.showPrompt 
        ? <p>
            {props.generation.template.display}{' '}
            <span class="Generation-Truth">{props.generation.prompt}</span>
          </p>
        : ""}
      <span style="white-space:pre-wrap;">
        {props.generation.generation.trim()}
      </span>
    </>
  }
}

export const Gisticle = {
  ...PromptGuessBase,
  Generation(props: {generation: PromptGeneration, showPrompt?: boolean}) {
    return <>
      {/* TODO: styling! */}
      <p>
        {props.generation.template.display}{' '}
        <span class="Generation-Truth HasUserText">
          {props.showPrompt ? props.generation.prompt : ""}
        </span>
      </p>
      <p class="HasUserText"><RenderText generation={props.generation} /></p>
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
