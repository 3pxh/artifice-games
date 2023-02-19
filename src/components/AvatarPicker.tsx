import { h, Fragment } from "preact";
import { useComputed, signal, Signal } from "@preact/signals";
import { ref, listAll, getDownloadURL } from "@firebase/storage";
import { storage } from "../firebaseClient";
import { PromptGuessRoom } from "../../functions/src/games/promptGuessBase";

const AVATARS:Signal<string[]> = signal([]);
listAll(ref(storage, "avatars")).then((res) => {
  res.items.forEach((v) => {
    getDownloadURL(v).then((url) => {
      AVATARS.value = [...AVATARS.value, url];
    });
  })
});

export default function AvatarPicker(props: {
  onSelect: (v: string) => void, 
  players: Signal<PromptGuessRoom["players"]>,
}) {
  // TODO: we could actually assign the players colors based on their id,
  // and show selection with a border outline of their color.
  // Colors would be the same as they'd have in chat.
  // However, making the colors stable seems tricky. (We could give them a joinedTime?)
  const selections = useComputed(() => {
    return Object.entries(props.players.value).map(([k, p]) => p.avatar ?? "");
  });

  const Avatar = (props: {url: string, selections: Signal<string[]>, onSelect: (v: string) => void}) => {
    // Nesting a computed signal allows us to be reactive on each one independently.
    const isSelected = useComputed(() => {
      return props.selections.value.some(a => a === props.url);
    });

    return <img 
      key={props.url}
      class={"Avatar " + (isSelected.value ? "Selected" : "Unselected")} 
      src={props.url} 
      onClick={() => { props.onSelect(props.url) }}
      width="64" />
  }

  return <div>
    {AVATARS.value.map(url => {
      return <Avatar url={url} selections={selections} onSelect={props.onSelect} />
    })}
  </div>
}
