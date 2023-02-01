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
    if (props.generation.error) {
      throw new Error(`Attempting to render Farsketched generation containing an error: ${props.generation.error}`)
    }
    if (props.generation.generation) {
      // All right. This is horrible. I admit.
      // We SHOULD sign a URL on the server and return that, it requires one less round trip.
      // Also, if we don't use a timeout here somehow Firebase throws an error that it doesn't exist!
      // TODO: figure out how to sign a fcking url on the server.
      window.setTimeout(() => {
        getDownloadURL(ref(storage, props.generation.generation)).then((url) => {
          setImage(url);
        });
      }, 2000);
    }
    useEffect(() => {console.log("render generation", props.generation.generation, image)})
    if (image) {
      return <>
        {/* TODO: styling! */}
        {props.showPrompt ? props.generation.prompt : ""}
        <img src={image} width="512" />
      </>
    } else {
      return <>Loading...</>
    }
  },
}

const RenderText = (props: {generation: PromptGeneration}) => {
  if (props.generation.error) {
    throw new Error(`Attempting to render text generation containing an error: ${props.generation.error}`)
  } else if (!props.generation.generation) {
    return <>
      Loading text generation...
    </>
  } else {
    return <span style="white-space:pre-wrap;">
      {props.generation.generation}
    </span>
  }
}

export const Gisticle = {
  ...PromptGuessBase,
  Generation(props: {generation: PromptGeneration, showPrompt?: boolean}) {
    return <>
      {/* TODO: styling! */}
      <p>{props.generation.template.display}</p>
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
