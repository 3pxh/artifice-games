import { h, Fragment, JSX } from "preact";
import { useState } from "preact/hooks";

export default function SingleUseButton(props: {
  buttonText: string,
  onClick: () => void,
  postSubmitContent?: JSX.Element,
}) {
  const [hasSubmitted, setHasSubmitted] = useState(false);

  if (hasSubmitted) {
    return <>
      {props.postSubmitContent ?? ""}
    </>
  } else {
    return <>
      <button onClick={() => { setHasSubmitted(true); props.onClick(); }}>{props.buttonText}</button>
    </>
  }
}
