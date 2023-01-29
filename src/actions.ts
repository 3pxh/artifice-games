import { ref, set, push } from "@firebase/database";
import { GameName } from "../functions/src/games/games";
import { db } from "./firebaseClient";
import { auth } from "./firebaseClient";

const createGame = (gameName: GameName): string | null => {
  if (auth.currentUser && auth.currentUser.email) {
    const r = {
      user: auth.currentUser.uid,
      gameName: gameName,
    }
    const k = push(ref(db, "rooms/")).key;
    set(ref(db, `rooms/${k}`), r);
    return k;
  } else {
    console.error("Cannot create a game without being authenticated by email");
    return null;
  }
}

const pingRoom = (roomId: string) => {
  set(ref(db, `rooms/${roomId}/startPing`), new Date().getTime());
}

const messageRoom = (roomId: string, m: any) => {
  const k = push(ref(db, `rooms/${roomId}/messages`)).key;
  set(ref(db, `rooms/${roomId}/messages/${k}`), m);
}

export { createGame, pingRoom, messageRoom }
