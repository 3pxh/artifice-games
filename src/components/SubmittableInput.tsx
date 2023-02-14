import { h, Fragment } from "preact";
import { useState } from "preact/hooks";

export default function SubmittableInput(props: {
  label: string,
  buttonText: string,
  onSubmit: (v: string) => void,
  postSubmitMessage?: string,
  placeholder?: string,
}) {
  const [input, setInput] = useState("");
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const submit = () => {
    setHasSubmitted(true); props.onSubmit(input);
  }

  if (hasSubmitted) {
    return <>
      {props.postSubmitMessage ?? ""}
    </>
  } else {
    return <>
      {props.label}
      <input 
        key={props.label} 
        placeholder={props.placeholder ?? ""}
        onInput={(e) => { setInput(e.currentTarget.value) }}
        onKeyDown={(e) => { if (e.key === "Enter") { submit(); } }}/>
      <button onClick={submit}>{props.buttonText}</button>
    </>
  }
}