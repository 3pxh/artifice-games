import { h, Fragment } from "preact";
import "./TextOptions.css";
import { useState, useContext } from "preact/hooks";
import { Signal, useComputed } from "@preact/signals";
import { seed32bit, shuffle, objectMap } from "../../functions/src/utils";
import { AuthContext } from "../AuthProvider";
import SingleUseButton from "./SingleUseButton";

export function TextOptions(props: {
  onSubmit: (uid: string) => void,
  options: {uid: string, value: string}[],
  disableUserOption?: boolean,
  shuffle?: boolean,
}) {
  // We need a stable shuffle or anytime this rerenders it moves them.
  const [seed, _] = useState(seed32bit());
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [vote, setVote] = useState("");
  const authContext = useContext(AuthContext);

  const options = props.shuffle ? shuffle(props.options, seed) : props.options;

  return <div class="TextOptions">
    {options.map((option) => {
      const disable = hasSubmitted || (props.disableUserOption && authContext.user?.uid === option.uid);
      const pickedClass = vote === option.uid ? "Picked" : "NotPicked";
      const className = `${(hasSubmitted ? pickedClass : "")}`
      return <button 
        class={"HasUserText " + className}
        key={option.uid} 
        onClick={() => {
          setHasSubmitted(true);
          setVote(option.uid);
          props.onSubmit(option.uid);
        }} disabled={disable}>{option.value}</button>
    })}
  </div>
};

export function ScoredTextOptions(props: {
  options: {uid: string, value: string}[],
  correctUid: string,
  votes: {[uid: string]: string},
  scores: {[uid: string]: {current: number, previous: number}},
  players: Signal<{[uid: string]: {handle?: string, avatar?: string}}>,
  onContinue: () => void,
}) {
  const playerData = useComputed(() => {
    const scores = props.scores;
    return objectMap<{handle?: string, avatar?: string}, {avatar?: string, handle?: string, current: number, previous: number}>(
      props.players.value, 
      (p, uid) => {return {avatar: p.avatar, handle: p.handle, ...scores[uid]}})
  });
  
  const options = props.options;

  return <div class="ScoredTextOptions">
    {options.map((option) => {
      const answerClass = props.correctUid === option.uid ? "Answer" : "NotAnswer";
      return <div 
        class={"ScoredTextOptions-Row HasUserText " + answerClass}
        key={option.uid} >
          {playerData.value[option.uid].handle}:
          {option.value}
      </div>
    })}
    <SingleUseButton 
      buttonText="Ready to continue!" 
      onClick={props.onContinue} 
      postSubmitContent={<>Waiting on others to continue...</>} />
  </div>
};
