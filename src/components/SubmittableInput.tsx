import { h, Fragment } from "preact";
import { useState } from "preact/hooks";
import "./SubmittableInput.css";

export default function SubmittableInput(props: {
  label: string,
  buttonText: string,
  onSubmit: (v: string) => void,
  postSubmitMessage?: string,
  placeholder?: string,
  maxLength?: number,
  submittedValue?: string,
}) {
  const [input, setInput] = useState("");
  const [hasSubmitted, setHasSubmitted] = useState(props.submittedValue ? true : false);

  const submit = () => {
    setHasSubmitted(true); props.onSubmit(input);
  }

  if (hasSubmitted) {
    return <>
      <p>{props.label}</p>
      <p>You put: {props.submittedValue || input}</p>
      {/* {props.submittedValue || props.postSubmitMessage || ""} */}
    </>
  } else {
    const closeToLimit = props.maxLength && (props.maxLength - input.length < 10);
    return <div class="SubmittableInput">
      {props.label}
      <div class="SubmittableInput-InputContainer">
        <input 
          class={props.maxLength ? "SubmittableInput--Limited" : ""}
          key={props.label} 
          placeholder={props.placeholder ?? ""}
          onInput={(e) => { 
            const v = e.currentTarget.value.substring(0, props.maxLength ?? e.currentTarget.value.length);
            setInput(v);
            e.currentTarget.value = v;
          }}
          onKeyDown={(e) => { if (e.key === "Enter") { submit(); } }}/>
        <span class={"SubmittableInput-CharacterLimit " + (closeToLimit ? "SubmittableInput--CloseToLimit" : "")}>
          {props.maxLength ? `${input.length}/${props.maxLength}` : ""}
        </span>
      </div>
      <button onClick={submit}>{props.buttonText}</button>
    </div>
  }
}