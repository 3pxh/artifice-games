import { h, Fragment, JSX } from "preact";
import { useState } from "preact/hooks";
import "./SingleUseButton.css";

//TODO: Pass this two elements, one of which has onClick already bound.
// See SlowBroadcastInput for inspiration with cloneElement.
export default function SingleUseButton(props: {
  buttonText: string,
  onClick: () => void,
  postSubmitContent?: JSX.Element,
  hasBeenUsed?: boolean,
}) {
  const [hasSubmitted, setHasSubmitted] = useState(props.hasBeenUsed ?? false);

  if (hasSubmitted) {
    return <>
      {props.postSubmitContent ?? ""}
    </>
  } else {
    return <>
      <button 
        class="SingleUseButton"
        onClick={() => { setHasSubmitted(true); props.onClick(); }}>{props.buttonText}</button>
    </>
  }
}
