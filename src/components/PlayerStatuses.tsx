import { h, Fragment } from "preact";
import { useComputed, Signal } from "@preact/signals";
import "./PlayerStatuses.css";
// TODO: Make a Player type that is game-independent.
import { Scores } from "../../functions/src/games/games";
import { PromptGuessRoom } from "../../functions/src/games/promptGuessBase";
import Avatar from "./Avatar";

export default function PlayerStatuses(props: {
  players: Signal<PromptGuessRoom["players"]>,
  scores: Scores | null
}) {
  const playerIds = useComputed(() => {
    if (props.scores) {
      const s = props.scores;
      return Object.keys(props.players.value).sort((u1, u2) => s[u2].current - s[u1].current);
    } else {
      return Object.keys(props.players.value);
    }
  });

  const Status = (props: {
    id: string, 
    players: Signal<PromptGuessRoom["players"]>
    scores: Scores | null
  }) => {
    const url = useComputed(() => {
      return props.players.value[props.id].avatar;
    });
    const handle = useComputed(() => {
      return props.players.value[props.id].handle;
    });

    return <Avatar
      key={props.id}
      url={url.value ?? ""}
      handle={handle.value ?? "anon"}
      showHandle={true}
      size={64}
      score={props.scores ? `${props.scores[props.id].current}` : undefined} />
  }

  // Show the scores, and sort left to right!
  return <div class="PlayerStatuses">
    {playerIds.value.map(id => {
      return <Status 
        id={id} 
        players={props.players} 
        scores={props.scores} />
    })}
  </div>
}
