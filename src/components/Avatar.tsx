import { h, Fragment } from "preact";
import "./Avatar.css";

export type AvatarState = "Ready" | "Waiting" | "Picked";

export default function Avatar(props: {
  url: string,
  handle: string,
  size: number,
  score?: string,
  state?: AvatarState,
  showHandle?: boolean,
}) {
  return <div class="Avatar-Container">
    <img 
      class="Avatar"
      src={props.url} 
      alt={props.handle} 
      width={props.size} 
      height={props.size} />
    {props.score ? <span class="Avatar-Score">{props.score}</span> : ""}
  </div>
}
