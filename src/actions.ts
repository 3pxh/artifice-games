import { ref, set, update, push, onValue } from "@firebase/database";
import { CreateRequest } from "../functions/src";
import { db } from "./firebaseClient";
import { auth } from "./firebaseClient";
import { RoomData } from "./Room";

const createGame = async (opts: CreateRequest): Promise<string> => {
  const k = push(ref(db, "rooms/")).key;
  if (!k) {
    throw new Error("Cannot create a new room id");
  }
  await set(ref(db, `rooms/${k}`), opts);
  return k;
}

const pingRoom = (roomId: string) => {
  console.log("ping room", new Date().getTime())
  set(ref(db, `rooms/${roomId}/_startPing`), new Date().getTime());
}

const joinRoom = async (shortcode: string, isPlayer: boolean, onSuccess: (id: string) => void, onError: (e: string) => void) => {
  if (auth.currentUser) {
    const k = push(ref(db, `joinRequests/${auth.currentUser.uid}/${shortcode}`)).key;
    // We need to wait until the data is set before reading for access control to work.
    await set(ref(db, `joinRequests/${auth.currentUser.uid}/${shortcode}/${k}`), {
      isPlayer: isPlayer
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
  const unsubscribe = onValue(roomRef, (v) => {
    const roomSnapshot = v.val() as RoomData;
    const isInitialized = roomSnapshot._initialized;
    if (isInitialized) {
      console.log("Got room data", roomSnapshot);
      cb({
        ...roomSnapshot,
        id: id, // This sits above the snapshot itself
      });
      // We NEED to clean this up. Keeping a full room sub alive is bad.
      unsubscribe();
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

export { createGame, pingRoom, joinRoom, getRoom, messageRoom, updatePlayer, setRoomLastSeenNow }
