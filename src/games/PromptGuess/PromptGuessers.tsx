import { h, Fragment } from "preact";
import { useEffect, useState } from "preact/hooks";
import { ref, getDownloadURL } from "@firebase/storage";
import { storage } from "../../firebaseClient";

import { PromptGeneration } from "../../../functions/src/games/promptGuessBase";
import * as PromptGuessBase from "./PromptGuessBase";


export const Farsketched = {
  ...PromptGuessBase,
  Generation(props: {generation: PromptGeneration, showPrompt?: boolean}) {
    const [image, setImage] = useState("");
    const [genUrl, setGenUrl] = useState("");

    useEffect(() => {
      if (props.generation.generation) {
        if (genUrl !== props.generation.generation) {
          setGenUrl(props.generation.generation);
          setImage(""); // Clear stale image while we try to load the new one.
        }
        // This interval retry is because the image can be passed to the generation
        // before it's actually available on storage.
        const getImage = () => {
          getDownloadURL(ref(storage, props.generation.generation)).then((url) => {
            setImage(url);
          }, (e) => {
            console.error("Tried to get an image before it was avaialble.");
            window.setTimeout(() => { getImage(); }, 1000);
          })
        }
        getImage();
      }
    })

    if (props.generation.error) {
      throw new Error(`Attempting to render Farsketched generation containing an error: ${props.generation.error}`)
    }

    if (image) {
      return <>
        {/* TODO: styling! */}
        {props.showPrompt ? <p>The truth was: <span class="Generation-Truth">{props.generation.prompt}</span></p> : ""}
        <img src={image} class="Generation-Image" />
      </>
    } else {
      return <>Loading...</>
    }
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
