import { h, Fragment } from "preact";
import "./TextOptions.css";
import { useState, useContext } from "preact/hooks";
import { Signal, useComputed } from "@preact/signals";
import { seed32bit, shuffle, objectMap } from "../../functions/src/utils";
import { AuthContext } from "../AuthProvider";
import SingleUseButton from "./SingleUseButton";
import Avatar from "./Avatar";

export function TextOptions(props: {
  onSubmit: (uid: string) => void,
  options: {uid: string, value: string}[],
  disableUserOption?: boolean,
  shuffle?: boolean,
  voteValue?: string,
}) {
  // We need a stable shuffle or anytime this rerenders it moves them.
  const [seed, _] = useState(seed32bit());
  const [hasSubmitted, setHasSubmitted] = useState(props.voteValue ? true : false);
  const [vote, setVote] = useState(props.voteValue ?? "");
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
  hasBeenContinued?: boolean,
  pointValues: {
    votedTruth?: number,
    authorOfTruth?: number,
    authorOfTruthVote?: number,
    authorOfLieVote?: number,
  }
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
      const isAnswer = props.correctUid === option.uid;
      const answerClass = isAnswer ? "Answer" : "NotAnswer";
      const p = playerData.value[option.uid];
      const voters = Object.entries(props.votes).filter(([k, v]) => v === option.uid);
      const authorPoints = 
        ((isAnswer && props.pointValues.authorOfTruth) 
          ? props.pointValues.authorOfTruth 
          : 0) +
        ((isAnswer && props.pointValues.authorOfTruthVote) 
          ? props.pointValues.authorOfTruthVote * voters.length
          : 0) +
        ((!isAnswer && props.pointValues.authorOfLieVote) 
          ? props.pointValues.authorOfLieVote * voters.length
          : 0);
      const voterPoints = (isAnswer && props.pointValues.votedTruth) ? props.pointValues.votedTruth : 0;
      return <div 
        class={"ScoredTextOptions-Row " + answerClass}
        key={option.uid} >
          {/* Note scores on the avatars? This one got 10 points if truth */}
          <div class="ScoredTextOptions-RowCreatorAvatar">
            <Avatar 
              url={p.avatar ?? ""} 
              handle={p.handle ?? ""} 
              size={48}
              score={authorPoints > 0 ? `+${authorPoints}` : undefined} />
          </div>
          <span class="ScoredTextOptions-RowText HasUserText">{option.value}</span>
          <div class="ScoredTextOptions-RowVoters">
            {voters.map(([u, _], i) => {
              const vp = playerData.value[u];
              return <Avatar 
                url={vp.avatar ?? ""} 
                handle={vp.handle ?? ""} 
                size={32}
                score={voterPoints > 0 ? `+${voterPoints}` : undefined} />
            })}
          </div>
      </div>
    })}
    <SingleUseButton 
      buttonText="Ready to continue!"
      hasBeenUsed={props.hasBeenContinued ?? false}
      onClick={props.onContinue} 
      postSubmitContent={<>Waiting on others to continue...</>} />
  </div>
};
