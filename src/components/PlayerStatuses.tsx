import { h, Fragment } from "preact";
import { useComputed, Signal } from "@preact/signals";
// TODO: Make a Player type that is game-independent.
import { PromptGuessRoom } from "../../functions/src/games/promptGuessBase";

export default function PlayerStatuses(props: {
  players: Signal<PromptGuessRoom["players"]>,
}) {
  const playerIds = useComputed(() => {
    return Object.keys(props.players.value);
  });

  const Status = (props: {id: string, players: Signal<PromptGuessRoom["players"]>}) => {
    const url = useComputed(() => {
      return props.players.value[props.id].avatar;
    });
    const handle = useComputed(() => {
      return props.players.value[props.id].handle;
    });

    return <div class="PlayerStatuses-Item">
      <img 
        key={url.value}
        class={"Avatar " + (props.players.value[props.id].isReadyToContinue ? "Waiting" : "Playing")}
        src={url.value}
        width="64" />
      <span class="PlayerStatus-Handle">{handle.value}</span>
    </div>
  }

  return <div class="PlayerStatuses">
    {playerIds.value.map(id => {
      return <Status id={id} players={props.players} />
    })}
  </div>
}
