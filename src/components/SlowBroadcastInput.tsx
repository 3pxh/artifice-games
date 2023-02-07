import { h, Fragment, JSX, cloneElement } from "preact";
import { useState } from "preact/hooks";

// For when we want to broadcast a value on change, but we don't want
// to broadcast it on every keystroke. Have a wait time
// which prevents sending if they keep typing.
export default function SlowBroadcastInput(props: {
  broadcast: (v: string) => void,
  input: JSX.Element,
  delayMs?: number,
}) {
  const [tIdx, setTIdx] = useState(0);

  const delayedBroadcast = (v: string) => {
    window.clearTimeout(tIdx);
    const i = window.setTimeout(() => {
      props.broadcast(v);
    }, props.delayMs ?? 1000)
    setTIdx(i);
  }

  const input = cloneElement(props.input, {
    onInput: (e:any) => { delayedBroadcast(e.currentTarget.value); 
  }});

  return <>{input}</>
}