import { h, Fragment } from "preact";
import { useContext, useEffect, useRef, useState } from "preact/hooks";
import { Signal, useComputed, useSignal } from "@preact/signals";
import { ref, onValue, limitToLast, query, push } from "@firebase/database";
import { db } from "../firebaseClient";
import {sendChat} from "../actions";
import { AuthContext } from "../AuthProvider";
import "./Chat.css";

type Messages = {[key: string]: {uid: string, content: string}};

export default function Chat(props: {
  roomId: string,
  players: Signal<{[uid: string]: {handle?: string, avatar?:string}} | null>,
  setHasUnreadMessages?: (hasUnread: boolean) => void,
  isActive: boolean,
}) {
  const authContext = useContext(AuthContext);
  const playerData = useComputed(() => {
    const p:{[uid: string]: {handle: string, avatar:string}} = {};
    Object.entries(props.players.value ?? {}).forEach(([uid, data]) => {
      p[uid] = {
        handle: data.handle ?? "anon",
        avatar: data.avatar ?? "",
      };
    });
    return p;
  });
  const [messageContent, setMessageContent] = useState("");
  const messages = useSignal<Messages>({});

  const scrollToBottom = () => {
    // Use a timeout so that it happens after the rerender.
    window.setTimeout(() => {
      const scroll = document.getElementById("Chat-Messages-Scroll");
      scroll?.scrollTo({
        top: scroll.scrollHeight
      });
    }, 0);
  }

  useEffect(() => {
    scrollToBottom();
  }, [props.isActive]);

  useEffect(() => {
    const chatRef = ref(db, `chats/${props.roomId}`);
    onValue(chatRef, (snapshot) => {
      messages.value = {
        ...messages.value,
        ...(snapshot.val() as Messages)
      };
    }, {onlyOnce: true});
    const MAX_NEW_MESSAGES = 5;
    const unsubscribe = onValue(query(chatRef, limitToLast(MAX_NEW_MESSAGES)), (snapshot) => {
      const unread = Object.keys(snapshot.val()).filter(k => !messages.value[k]).length;
      if (unread > 0 && props.setHasUnreadMessages) {
        props.setHasUnreadMessages(true);
      }
      messages.value = {
        ...messages.value,
        ...(snapshot.val() as Messages)
      };
      scrollToBottom();
    });
    scrollToBottom();
    return unsubscribe;
  }, []);

  const sendMessage = () => {
    if (!authContext.user) {
      return;
    }
    const k = sendChat(props.roomId, messageContent);
    if (k) {
      messages.value = {
        ...messages.value,
        [k]: {
          uid: authContext.user.uid,
          content: messageContent,
        }
      };
      setMessageContent("");
      scrollToBottom();
    }
  }

  if (!authContext.user) {
    return <></>
  }
  return <div class="Chat">
    <div class="Chat-Header">
    </div>
    <div class="Chat-Messages" id="Chat-Messages-Scroll">
      {Object.entries(messages.value)
      .sort(([k1,_], [k2,__]) => k1 < k2 ? -1 : 1)
      .map(([key, message]) => {
        return <div class="Chat-Message" key={key}>
          {playerData.value[message.uid].handle}: {message.content}
        </div>
      })}
    </div>
    <div class="Chat-Input">
      {playerData.value[authContext.user.uid].handle}:
      <input 
        onInput={(e) => {setMessageContent(e.currentTarget.value.trim())}}
        value={messageContent}
        onKeyDown={(e) => { if (e.key === "Enter") { sendMessage(); } }} />
      <button onClick={sendMessage}>Send</button>
    </div>
  </div>
}
