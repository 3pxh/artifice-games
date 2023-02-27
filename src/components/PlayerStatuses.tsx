import { h, Fragment } from "preact";
import { useComputed, Signal } from "@preact/signals";
import { objectFilter } from "../../functions/src/utils";
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
    const players = objectFilter(props.players.value, (p) => p.isPlayer);
    if (props.scores) {
      const s = props.scores;
      return Object.keys(players).sort((u1, u2) => s[u2]?.current ?? 0 - s[u1]?.current ?? 0);
    } else {
      return Object.keys(players).sort((u1, u2) => u1 < u2 ? -1 : 1);
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
    const isReadyToContinue = useComputed(() => {
      return props.players.value[props.id].isReadyToContinue;
    });

    return <Avatar
      key={props.id}
      url={url.value ?? ""}
      handle={handle.value ?? "anon"}
      showHandle={true}
      state={isReadyToContinue.value ? "Waiting" : "Doing"}
      size={64}
      score={props.scores ? `${props.scores[props.id]?.current ?? 0}` : undefined} />
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
