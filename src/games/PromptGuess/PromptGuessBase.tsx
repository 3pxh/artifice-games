import { h, Fragment } from "preact";
import { useState } from "preact/hooks";
import { PromptGeneration, PromptGuessRoom } from "../../../functions/src/games/promptGuessBase"

export function LabeledInput(props: {prefix: string, onSubmit: (prompt: string) => void}) {
  const [input, setInput] = useState("");
  return <>
    {props.prefix ?? "Make something fun:"}
    <input onChange={(e) => { setInput(e.currentTarget.value) }} />
    <button onClick={() => { props.onSubmit(input) }}>Go</button>
  </>
}

export const PromptGuessBase = {
  Prompt(props: {onSubmit: (prompt: string) => void}) {
    return LabeledInput({
      ...props,
      prefix: "Make something fun:"
    })
  },
  
  Lie(props: {onSubmit: (lie: string) => void}) {
    return LabeledInput({
      ...props,
      prefix: "Write a lie:"
    })
  },
  
  LieChoices(props: {
    onSubmit: (id: string) => void,
    lies: PromptGuessRoom["gameState"]["lies"]
  }) {
    return <>
      {Object.entries(props.lies).map(([k,v]) => {
        return <>
          <button onClick={() => {
            props.onSubmit(k);
          }}>{v}</button>
        </>
      })}
    </>
  },
  
  Generation(props: {generation: PromptGeneration}) {
    return <>
      Unimplemented Generation renderer for {props.generation.type}
    </>
  },
  
  Scoreboard(props: {
    scores: PromptGuessRoom["gameState"]["scores"]
  }) {
    return <>
      {Object.entries(props.scores).map(([k,v]) => {
        return <>
          {k}: {v.current}
        </>
      })}
    </>
  }
}
