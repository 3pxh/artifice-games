import { h, Fragment } from "preact";
import { useState } from "preact/hooks";

export enum States { Lobby, Intro, Prompt, AfterPrompt, 
  Lie, AfterLie, Vote, AfterVote, Score, Finish
}

// TODO: figure out how to make well defined Generation types for the various games?
// Easiest is to throw optional fields on it :/
export type GameState = {
  state: States,
  generation: {type: string},
  lies: {id: string, lie: string}[],
  scores: {id: string, score: number}[],
}

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
    lies: {id: string, lie: string}[],
  }) {
    return <>
      {props.lies.map(l => {
        return <>
          <button onClick={() => {
            props.onSubmit(l.id);
          }}>{l.lie}</button>
        </>
      })}
    </>
  },
  
  Generation(props: {generation: {type: string}}) {
    return <>
      Unimplemented Generation renderer for {props.generation.type}
    </>
  },
  
  Scoreboard(props: {
    scores: {score: number}[]
  }) {
    return <>
      {props.scores.map(s => {
        return <>
          {s.score}
        </>
      })}
    </>
  }
}
