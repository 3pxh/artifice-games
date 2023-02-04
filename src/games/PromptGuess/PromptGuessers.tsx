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
      // So I tried constructing a url by hand, easy enough with this link format:
      // https://firebasestorage.googleapis.com/v0/b/threepixelheart-f5674.appspot.com/o/images%2myfile.png?alt=media
      // http://127.0.0.1:9199/v0/b/threepixelheart-f5674.appspot.com/o/images%2Fmyfile.png?alt=media
      // But it loads too quickly and gives a broken image! 
      // So getDownloadURL is (slow but) fine and we need this timeout if it was just made.
      const isSafeToLoad = (props.generation.timeFulfilled ?? 0) < new Date().getTime() - 3000;
      window.setTimeout(() => {
        getDownloadURL(ref(storage, props.generation.generation)).then((url) => {
          setImage(url);
        });
      }, isSafeToLoad ? 0 : 2000);
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