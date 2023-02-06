import { h, Fragment } from "preact";
import { useState } from "preact/hooks";

export default function SubmittableInput(props: {
  label: string,
  buttonText: string,
  onSubmit: (v: string) => void,
  postSubmitMessage?: string,
}) {
  const [input, setInput] = useState("");
  const [hasSubmitted, setHasSubmitted] = useState(false);

  if (hasSubmitted) {
    return <>
      {props.postSubmitMessage ?? ""}
    </>
  } else {
    return <>
      {props.label}
      <input key={props.label} onChange={(e) => { setInput(e.currentTarget.value) }} />
      <button onClick={() => { setHasSubmitted(true); props.onSubmit(input); }}>{props.buttonText}</button>
    </>
  }
}