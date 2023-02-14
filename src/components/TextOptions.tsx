import { h, Fragment } from "preact";
import "./TextOptions.css";
import { useState, useContext } from "preact/hooks";
import { seed32bit, shuffle } from "../../functions/src/utils";
import { AuthContext } from "../AuthProvider";

export default function TextOptions(props: {
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
      return <button 
        class={"HasUserText " + (vote === option.uid ? "Picked" : "NotPicked")}
        key={option.uid} 
        onClick={() => {
          setHasSubmitted(true);
          setVote(option.uid);
          props.onSubmit(option.uid);
        }} disabled={disable}>{option.value}</button>
    })}
  </div>
};
