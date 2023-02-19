import { h, Fragment } from "preact";
import "./Avatar.css";

export type AvatarState = "Waiting" | "Doing" | "Picked";

export default function Avatar(props: {
  url: string,
  handle: string,
  size: number,
  score?: string,
  state?: AvatarState,
  showHandle?: boolean,
}) {
  const waitingClass = props.state === "Waiting" ? "Avatar--Waiting" : "";
  return <div class="Avatar-Container">
    <img 
      class={`Avatar ${waitingClass}`}
      src={props.url} 
      alt={props.handle} 
      width={props.size} 
      height={props.size} />
    {props.score ? <span class="Avatar-Score">{props.score}</span> : ""}
    {props.showHandle ? <span class="Avatar-Handle">{props.handle}</span> : ""}
  </div>
}
