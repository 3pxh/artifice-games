import { h, Fragment } from "preact";
import { useContext, useState } from "preact/hooks";
import { computed, Signal, ReadonlySignal } from "@preact/signals";
import * as MITM from "../../../functions/src/games/mitm";
import { AuthContext } from "../../AuthProvider";
import { messageRoom } from "../../actions";
import SingleUseButton from "../../components/SingleUseButton";
import "./mitm.css";

export const Subscriptions:Record<keyof MITM.Room["gameState"], boolean> = {
  "timer": false,
  "state": false,
  "player1": false,
  "player2": false,
  "chat1": true,
  "chat2": true,
  "whoCalledRobot": false,
  "stepsBeforeMITM": false,
  "currentStep": false,
  "generations": false,
}

export function RenderMitm(props: {
  room: MITM.Room & {id: string},
  gameState: Signal<MITM.Room["gameState"]>,
  isPlayer: boolean,
  isInputOnly: boolean,
}) {
  const { user } = useContext(AuthContext);

  // TODO: This triggers a full rerender 5x a second.
  // We use time in order to determine what chats to display.
  // Better would be to have the player's chat be a signal with only
  // the chats after the present time. When we receive new chats,
  // schedule a timeout to add them to the signal's value at the right time.
  // However even with the current sloppiness it doesn't seem to impact perf.
  const [time, setTime] = useState(Date.now());
  

  if (!user) {
    throw new Error("User isn't defined in game renderer!");
  }
  
  const renderState:ReadonlySignal<MITM.State> = computed(() => {
    return props.gameState.value.state
  });
  const player1:ReadonlySignal<string> = computed(() => {
    return props.gameState.value.player1
  });
  const myChat = computed(() => user.uid === props.gameState.value.player1 ? props.gameState.value.chat1 : props.gameState.value.chat2)

  window.setInterval(() => {    
    setTime(Date.now());
    // Scroll to bottom on new messages.
    const chatContainer = document.getElementById("MITM-ScrollingContainer");
    if (chatContainer) {
      const chatArray = myChat.value ? Object.entries(myChat.value) : [];
      const chatEntries:[number, {author:string, message:string}][] = chatArray.map(([timestamp, message]) => { return [parseInt(timestamp), message] });
      const c = chatEntries.sort(([t1, _], [t2, __]) => {return t1 - t2});
      const lastMessageTimestamp = (c && c.length) ? c[c.length-1][0] : null;
      if (lastMessageTimestamp) {
        if (lastMessageTimestamp > Date.now() - 200 && lastMessageTimestamp < Date.now()) {
          chatContainer.scrollTop = chatContainer.scrollHeight;
        }
      }
    }
  }, 200);

  const message = (type: MITM.Message["type"], value: string) => {
    const m:Omit<MITM.Message, "uid"> = {
      type: type,
      value: value,
    }
    messageRoom(props.room.id, m);
  }

  const sendMessage = () => {
    const chatArray = myChat.value ? Object.entries(myChat.value) : [];
    const chatEntries:[number, {author:string, message:string}][] = chatArray.map(([timestamp, message]) => { return [parseInt(timestamp), message] });
    const c = chatEntries.sort(([t1, _], [t2, __]) => {return t1 - t2});
    const isMyTurn = c.length === 0 ? user.uid === player1.value : c[c.length - 1][1].author !== user.uid;
    const input = document.getElementById("MITM-MessageInput") as HTMLInputElement;
    if (input && isMyTurn && !(!!c && !!c.length && (c[c.length - 1][0] > time))) {
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
    const chatEntries:[number, {author:string, message:string}][] = chatArray.map(([timestamp, message]) => { return [parseInt(timestamp), message] });
    const c = chatEntries.sort(([t1, _], [t2, __]) => {return t1 - t2});
    const isMyTurn = c.length === 0 ? user.uid === player1.value : c[c.length - 1][1].author !== user.uid;
    return <div class="MITM-Container">
      <div class="MITM-Chats" id="MITM-ScrollingContainer">
        {c.map(([t, message]) => {
          return t < time ? <p key={t} class={message.author === user.uid ? "MITM-Chat--FromMe" : "MITM-Chat--FromThem"}><p class="MITM-ChatText">{message.message}</p></p> : "";
        })}
      </div>
      <input id="MITM-MessageInput" type="text" onKeyPress={(e) => {if (e.key === "Enter") {sendMessage()}}} />
      <button disabled={!isMyTurn || (!!c && !!c.length && (c[c.length - 1][0] > time))} onClick={sendMessage}>Send</button>
      <button disabled={c.length < 10} onClick={() => message("ICallRobot", "woo!")}>I Call Robot!</button>
    </div>
  } else if (renderState.value === "Finish") {
    // TODO: refactor rendering the chat. This is almost verbatim from above.
    const chatArray = myChat.value ? Object.entries(myChat.value) : [];
    const chatEntries:[number, {author:string, message:string}][] = chatArray.map(([timestamp, message]) => { return [parseInt(timestamp), message] });
    const c = chatEntries.sort(([t1, _], [t2, __]) => {return t1 - t2});
    return <>
      {props.gameState.value.whoCalledRobot === user.uid ? <p>You called robot!</p> : <p>The other player called robot!</p>}
      {props.gameState.value.currentStep >= props.gameState.value.stepsBeforeMITM ? <p>And you were both talking to robots.</p> : <p>But it was called too early.</p>}
      <p>You're all winners!</p>
      <div class="MITM-Container">
      <div class="MITM-Chats" id="MITM-ScrollingContainer">
        {c.map(([t, message]) => {
          const style = (message.author === "robot") ? "MITM-Chat--FromRobot" : (message.author === user.uid ? "MITM-Chat--FromMe" : "MITM-Chat--FromThem");
          return t < time ? <p key={t} class={style}><p class="MITM-ChatText">{message.message}</p></p> : "";
        })}
      </div>
    </div>
      <p>
        I originally conceived of this game as an installation with the players each in a telephone booth,
        where the audience outside can see both transcripts as they happen.
        If you'd like to help make that happen, please get in touch with me at <a href="mailto:george@hoqqanen.com">george@hoqqanen.com</a>!
      </p>
    </>
  } else {
    return <p>Congrats, you hit an unrecognized game state!</p>
  }
}
