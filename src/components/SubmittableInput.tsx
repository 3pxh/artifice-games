import { h, Fragment } from "preact";
import { useState } from "preact/hooks";

export default function SubmittableInput(props: {
  label: string,
  buttonText: string,
  onSubmit: (v: string) => void
}) {
  const [input, setInput] = useState("");
  return <>
    {props.label}
    <input onChange={(e) => { setInput(e.currentTarget.value) }} />
    <button onClick={() => { props.onSubmit(input) }}>{props.buttonText}</button>
  </>
}