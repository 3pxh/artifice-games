import { ref, set, update, push, onValue, get } from "@firebase/database";
import { CreateRequest } from "../functions/src";
import { db } from "./firebaseClient";
import { auth } from "./firebaseClient";
import { RoomData } from "./Room";

const createGame = async (opts: CreateRequest, onSuccess: (id: string) => void, onError: (e: string) => void): Promise<void> => {
  if (auth.currentUser) {
    const k = push(ref(db, `newGameRequests/${auth.currentUser.uid}`)).key;
    if (!k) {
      onError("Failed to create a new room id");
    }
    const createRequestRef = ref(db, `newGameRequests/${auth.currentUser.uid}/${k}`);
    await set(createRequestRef, opts);
    const unsubscribe = onValue(createRequestRef, (v) => {
      const request = v.val();
      // TODO: typechecking
      if (request.success) {
        console.log("create succeeded", request.success.roomId);
        onSuccess(request.success.roomId);
        unsubscribe();
      } else if (request.error) {
        unsubscribe();
        console.log("create fail", request.error);
        onError(request.error);
      }
    });
  }
}

const sendChat = (roomId: string, message: string) => {
  if (auth.currentUser) {
    const k = push(ref(db, `chats/${roomId}`)).key;
    if (k) {
      update(ref(db, `chats/${roomId}/${k}`), {
        content: message,
        uid: auth.currentUser.uid,
      });
      return k;
    }
  }
}

const pingRoom = (roomId: string) => {
  console.log("ping room", new Date().getTime())
  set(ref(db, `rooms/${roomId}/_startPing`), new Date().getTime());
}

const joinRoom = async (shortcode: string, isPlayer: boolean, onSuccess: (id: string) => void, onError: (e: string) => void, id?: string) => {
  if (auth.currentUser) {
    const k = push(ref(db, `joinRequests/${auth.currentUser.uid}/${shortcode}`)).key;
    // We need to wait until the data is set before reading for access control to work.
    const idAmendment = id ? {roomId: id} : {};
    await set(ref(db, `joinRequests/${auth.currentUser.uid}/${shortcode}/${k}`), {
      ...idAmendment,
      isPlayer: isPlayer,
    });
    const joinRef = ref(db, `joinRequests/${auth.currentUser.uid}/${shortcode}/${k}`);
    const unsubscribe = onValue(joinRef, (v) => {
      const request = v.val();
      // TODO: typechecking
      if (request.success) {
        onSuccess(request.success.roomId);
        unsubscribe();
      } else if (request.error) {
        unsubscribe();
        onError(request.error);
      }
    });
  } else {
    onError("Must be authenticated to join a room");
  }
}

const getRoom = (id: string, cb: (r: RoomData) => void) => {
  const roomRef = ref(db, `rooms/${id}`);
  get(roomRef).catch((e) => {
    // If we don't have access, try to join the room.
    joinRoom("_byID", true, 
      () => {
        get(roomRef).then((v) => {
          cb(v.val())
        })
      },
      (e: string) => {
        console.log("Failed to join room ", id, e)
      },
      id
    )
  });
  const initializedRef = ref(db, `rooms/${id}/_initialized`);
  const unsubscribe = onValue(initializedRef, (v) => {
    const isInitialized = v.val() as boolean;
    if (isInitialized) {
      get(roomRef).then((v) => {
        cb(v.val())
        unsubscribe();
      });
    }
  });
}

// Rely on in-game typings to wrap this type-safely.
const messageRoom = (roomId: string, m: any) => {
  if (auth.currentUser) {
    const k = push(ref(db, `rooms/${roomId}/messages`)).key;
    set(ref(db, `rooms/${roomId}/messages/${k}`), {
      ...m,
      uid: auth.currentUser.uid
    });  
  } else {
    throw new Error("Must be authenticated to message room")
  }
}

const setScratchpad = (roomId: string, s: any) => {
  if (auth.currentUser) {
    set(ref(db, `rooms/${roomId}/scratchpad`), s);
  } else {
    throw new Error("Must be authenticated to message room")
  }
}

const setRoomLastSeenNow = (roomId: string) => {
  // TODO: any sort of type checking...
  if (auth.currentUser) {
    set(ref(db, `memberships/${auth.currentUser.uid}/${roomId}/lastSeen`), new Date().getTime());  
  }
}

const updatePlayer = (roomId: string, m: any) => {
  if (auth.currentUser) {
    update(ref(db, `rooms/${roomId}/players/${auth.currentUser.uid}`), m);
  } else {
    throw new Error("Must be authenticated to update player object");
  }
}

export { createGame, pingRoom, joinRoom, getRoom, messageRoom, setScratchpad, updatePlayer, setRoomLastSeenNow, sendChat }
