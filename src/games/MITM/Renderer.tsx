import { h, Fragment } from "preact";
import { useContext } from "preact/hooks";
import { computed, Signal, ReadonlySignal } from "@preact/signals";
import * as MITM from "../../../functions/src/games/mitm";
import { AuthContext } from "../../AuthProvider";
import { messageRoom } from "../../actions";
import SingleUseButton from "../../components/SingleUseButton";

export function RenderMitm(props: {
  room: MITM.Room & {id: string},
  gameState: Signal<MITM.Room["gameState"]>,
  isPlayer: boolean,
  isInputOnly: boolean,
}) {
  const { user } = useContext(AuthContext);
  if (!user) {
    throw new Error("User isn't defined in game renderer!");
  }
  
  const renderState:ReadonlySignal<MITM.State> = computed(() => {
    return props.gameState.value.state
  });
  const currentStep:ReadonlySignal<number> = computed(() => {
    return props.gameState.value.currentStep
  });
  const player1:ReadonlySignal<string> = computed(() => {
    return props.gameState.value.player1
  });
  const myChat = computed(() => user.uid === props.gameState.value.player1 ? props.gameState.value.chat1 : props.gameState.value.chat2)

  const message = (type: MITM.Message["type"], value: string) => {
    const m:Omit<MITM.Message, "uid"> = {
      type: type,
      value: value,
    }
    messageRoom(props.room.id, m);
  }

  const sendMessage = () => {
    const input = document.getElementById("MITM-MessageInput") as HTMLInputElement;
    if (input) {
      message("ChatMessage", input.value);
      input.value = "";
    }
  }

  if (renderState.value === "Lobby") {
    // TODO: don't show the button unless they have a name and avatar.
    return <div class="PromptGuessLobby">
      <SingleUseButton 
        key="LobbyContinue"
        buttonText="Start!"
        onClick={() => {message("Start", "gogogo!")}}
        postSubmitContent={<>Starting up...</>} />
    </div>
  } else if (renderState.value === "Chat" || renderState.value === "MITM") {
    const chatArray = myChat.value ? Object.entries(myChat.value) : [];
    const c:[number, {author:string, message:string}][] = chatArray.map(([timestamp, message]) => { return [parseInt(timestamp), message] })
    const isMyTurn = c.length === 0 ? user.uid === player1.value : c[c.length - 1][1].author !== user.uid;
    return <div class="MITM-Container">
      <div class="MITM-Chats">
        {c.sort(([t1, _], [t2, __]) => {return t1 - t2}).map(([t, message]) => {
          return <p key={t} class={message.author === user.uid ? "MITM-Chat--FromMe" : "MITM-Chat--FromThem"}>{message.message}</p>
        })}
      </div>
      <input id="MITM-MessageInput" />
      <button disabled={!isMyTurn} onClick={sendMessage}>Send</button>
      <button disabled={c.length < 10} onClick={() => message("ICallRobot", "woo!")}>I Call Robot!</button>
    </div>
  } else if (renderState.value === "Finish") {
    return <>
      {props.gameState.value.whoCalledRobot === user.uid ? <p>You called robot!</p> : <p>The other player called robot!</p>}
      {props.gameState.value.currentStep >= props.gameState.value.stepsBeforeMITM ? <p>And you were both talking to robots.</p> : <p>But it was called too early.</p>}
      <p>You're all winners!</p>
    </>
  } else {
    return <p>Congrats, you hit an unrecognized game state!</p>
  }
}
