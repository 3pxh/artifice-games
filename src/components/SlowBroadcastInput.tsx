import { h, Fragment } from "preact";
import { useState } from "preact/hooks";

// For when we want to broadcast a value on change, but we don't want
// to broadcast it on every keystroke. Have an interrupt time
// which prevents sending if they keep typing.

// TODO: I'd like this to be more transparent to the <input> underneath,
// e.g. for giving it classes, an id to make a label, etc.
// Open question: how would we do that? Creating a CancelableInputContext
// which is used as a provider with an input inside of it? And then binding
// onInput to that context's cancelableBroadcast (which handles the timeout).
export default function SlowBroadcastInput(props: {broadcast: (v: string) => void, interrupt?: number}) {
  const [tIdx, setTIdx] = useState(0);

  const delayedBroadcast = (v: string) => {
    window.clearTimeout(tIdx);
    const i = window.setTimeout(() => {
      props.broadcast(v);
    }, props.interrupt ?? 1000)
    setTIdx(i);
  }

  return <>
    <input onInput={(e) => { delayedBroadcast(e.currentTarget.value); }}></input>
  </>
}