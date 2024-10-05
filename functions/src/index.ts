import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { Reference } from "firebase-admin/database";
import { generate, GenerationRequest } from "./generate";
import App from "./app";

import { engines, GameCreateData, EngineName } from "./games/games";
import { ROOM_FINISHED_STATE } from "./utils";

App.instance;

export type CreateRequest = {
  gameId: string, // games/{gameId} in the database
} & GameCreateData;

type GameData = {
  engine: EngineName,
  name: string,
}

type RoomState = {
  _isAsync: boolean
  gameState: {state: string}
  players: {[uid: string]: any}
  definition: {
    engine: string,
    name: string
  }
}

type ShortcodeData = {
  room: string,
  timestamp: number,
}

// After a day, the same shortcode can be used.
const ROOM_EXPIRY = new Date().getTime() - 1000*60*60*24;

const createShortcode = async (roomId: string, retries = 0): Promise<string> => {
  if (retries > 10) {
    throw new Error(`Failed to create shortcode after ${retries} retries`);
  }
  let shortcode = "";
  for ( let i = 0; i < 4; i++ ) {
    shortcode += "ABCDEFGHIJKLMNOPQRSTUVWXYZ".charAt(Math.floor(Math.random() * 26));
  }
  const codeData = (await admin.database().ref(`/shortcodes/${shortcode}`).get()).val() as ShortcodeData | null;
  if (codeData && codeData.timestamp > ROOM_EXPIRY) { // currently in use
    return createShortcode(roomId, retries + 1);
  } else {
    await admin.database().ref(`/shortcodes/${shortcode}`).set({
      room: roomId,
      timestamp: new Date().getTime(),
    });
    return shortcode;
  }
}

const getRoomFromShortcode = async (shortcode: string): Promise<string> => {
  const roomId = await admin.database().ref(`/shortcodes/${shortcode}/room`).get();
  if (roomId.val()) {
    return roomId.val();
  } else {
    throw new Error(`Tried to get a room for unused shortcode: ${shortcode}`);
  }
}

const QUEUE_DURATION = 1 * 1000;
const QUEUE_MAX_WAIT = 3600/2 * 1000; // Half hour
const MAX_QUEUE_LENGTH = 150;
export type QueueData = {
  inQueue: boolean,
  startTime: number,  
}
export type QueueRoom = {
  _shortcode: string,
  _startPing: number,
  _createDate: number,
  _queue: QueueData,
  _creator: string,
  _initialized: boolean,
  _isAsync: boolean,
  _isFinished: boolean,
}

const roomStartTime = async (r: QueueRoom) => {
  const spot = await getSpotInLine(r);
  return (spot + 1) * QUEUE_DURATION + new Date().getTime();
}

const getSpotInLine = async (r: QueueRoom) => {
  const now = new Date().getTime();
  const t = r._createDate;
  if (now - t > QUEUE_MAX_WAIT) {
    return 0;
  } else {
    const queuedRooms = await admin.database().ref("/rooms").orderByChild("_queue/startTime").limitToLast(MAX_QUEUE_LENGTH).get();
    const rooms = Object.entries(queuedRooms.val() ?? {}) as [string, QueueRoom][];
    const activeRoomsInLine = rooms.filter(([k, r2]) => {
      return r2._queue && r2._queue.inQueue && // Hasn't been started
        r2._createDate < t && // Made before this room
        r2._queue.startTime > now; // Not abandoned.
    });
    return activeRoomsInLine.length;
  }
}

export type MembershipData = {
  uid: string,
  rid: string,
  gameName: string,
  isAsync: boolean,
  timestamp: number,
  lastUpdate: number,
  lastSeen: number,
  isFinished: boolean,
}
type MembershipCreateData = Omit<MembershipData, "timestamp" | "lastUpdate" | "lastSeen">
const createMembership = async (m: MembershipCreateData) => {
  const now = new Date().getTime();
  await admin.database().ref(`/memberships/${m.uid}/${m.rid}`).set({
    gameName: m.gameName,
    isAsync: m.isAsync,
    lastSeen: now,
    timestamp: now,
    lastUpdate: now,
  });
}

export type CreateResponse = {
  success?: {
    roomId: string
  }
  error?: string
}

export const createRoom = async (req: CreateRequest, createRequestRef: Reference) => {
    // TODO: Disallow creating many rooms at once.
    // Could be done via DB permissions.
    const msg = req;
    // The database can store data that doesn't match types. How do we check it?
    const gameData = (await admin.database().ref(`/games/${msg.gameId}`).get()).val();
    if (!gameData) {
      functions.logger.error("createRoom: Game not found", {msg});
      return createRequestRef.update({
        error: `Game with id ${msg.gameId} not found!`
      } as CreateResponse);
    }
    const roomRef = await admin.database().ref("/rooms").push();
    const key = roomRef.key;
    if (!key) {
      functions.logger.error("createRoom: Error generating room id", {msg});
      return createRequestRef.update({
        error: "Error generating room id"
      } as CreateResponse);
    }
    const engineName:EngineName = (gameData as GameData).engine;
    const gameRoom = engines[engineName].init(msg, gameData as any);
    const now = new Date().getTime();
    const shortcode: string = await createShortcode(key);
    const roomWithQueueState = {
      ...gameRoom,
      _shortcode: shortcode,
      _startPing: now,
      _createDate: now,
      _queue: {
        inQueue: true,
        startTime: 0, 
      },
      _creator: msg._creator,
      _initialized: true,
      _isAsync: msg._isAsync,
      _isFinished: false,
    } satisfies QueueRoom;
    const start = await roomStartTime(roomWithQueueState);
    roomWithQueueState._queue.startTime = start;
    await createMembership({
      gameName: (gameData as GameData).name,
      uid: msg._creator,
      rid: key,
      isAsync: msg._isAsync,
      isFinished: false,
    });
    await roomRef.set(roomWithQueueState);
    return createRequestRef.update({
      success: {
        roomId: key
      }
    } as CreateResponse);
}

export const roomPingedToStart = functions.database.ref("/rooms/{id}/_startPing")
  .onUpdate(async (snapshot, context) => {
    const thisRoom = (await snapshot.before.ref.parent?.get())?.val() as QueueRoom;
    // TODO: Account for abandoned rooms to speed up the queue?
    if (thisRoom._queue.startTime < new Date().getTime()) {
      return admin.database().ref(`/rooms/${context.params.id}/_queue/inQueue`).set(false);
    }
});

export const newGameRequestCreated = functions.database.ref("/newGameRequests/{uid}/{k}")
  .onCreate(async (snapshot, context) => {
    const msg = snapshot.val() as CreateRequest;
    functions.logger.log("Processing new game request", {val: msg});
    const gameData = (await admin.database().ref(`/games/${msg.gameId}`).get()).val();
    if (!gameData) {
      functions.logger.error("newGameRequestCreated: Game not found", {msg});
      return snapshot.ref.update({
        error: `Game with id ${msg.gameId} not found!`
      } as CreateResponse);
    } 
    /* TODO: reenable billing
    const user = await admin.auth().getUser(context.params.uid);
    const isUnderwriter = user.customClaims && user.customClaims.stripeRole === "underwriter";
    else if (gameData.tier !== "Free" && !isUnderwriter) {
      return snapshot.ref.update({
        error: "Support Artifice to start that game."
      } as CreateResponse);
    } 
    */
    else {
      return createRoom(msg, snapshot.ref);
    }
});

export const joinRequestCreated = functions.database.ref("/joinRequests/{uid}/{code}/{k}")
  .onCreate(async (snapshot, context) => {
    const isPlayer = snapshot.val().isPlayer;
    let roomId;
    if (snapshot.val().roomId) { // Made via an invite link.
      roomId = snapshot.val().roomId;
    } else {
      try {
        roomId = await getRoomFromShortcode(context.params.code);
      } catch (e) {
        return snapshot.ref.child("error").set("Room with that shortcode not found");
      }
    }
    if (!roomId) {
      return snapshot.ref.child("error").set("That room does not exist");
    }
    const room = (await admin.database().ref(`/rooms/${roomId}`).get()).val() as (RoomState & QueueRoom);
    const players = Object.keys(room.players);
    const hasAlreadyJoined = players.find(p => p === context.params.uid);
    if (room._isFinished && !hasAlreadyJoined) {
      return snapshot.ref.child("error").set("That room is no longer active and cannot be joined.");
    }
    const user = await admin.auth().getUser(context.params.uid);
    const isAnonymous = !user.email;
    if (room._isAsync && isAnonymous) {
      return snapshot.ref.child("error").set("Cannot join async rooms anonymously. Log in with an email address.");
    } else if (hasAlreadyJoined) {
      return snapshot.ref.child("success").set({
        roomId,
        timestamp: new Date().getTime()
      });
    } else {
      // Right now we let people join at any time. Is there any reason why not?
      // Abuse prevention of people spamming requests to all room codes? (We can rate limit that.)
      await admin.database().ref(`/rooms/${roomId}/messages`).push({
        type: "NewPlayer",
        uid: context.params.uid,
        isPlayer: isPlayer,
      });
      // The user's player key must exist in order to access the room via permissions.
      await admin.database().ref(`/rooms/${roomId}/players/${context.params.uid}/_init`).set(true);
      await createMembership({
        gameName: room.definition.name,
        uid: context.params.uid,
        rid: roomId,
        isAsync: room._isAsync,
        isFinished: false,
      });
      return snapshot.ref.child("success").set({
        roomId,
        timestamp: new Date().getTime()
      });
    } 
    // TODO: Clean up old join requests (expire after a day?)
    // Since we create a new one each time, and adding a uid should be idempotent,
    // it's just a sanitation problem not a functionality problem.
});

export const roomMessaged = functions.database.ref("/rooms/{id}/messages/{key}")
  .onCreate(async (snapshot, context) => {
    let oldState, newState;
    let players:string[] = [];
    await snapshot.ref.parent!.parent!.transaction((room) => {
      if (room) {
        oldState = room.gameState.state;
        players = Object.keys(room.players);
        const engineName = room.definition.engine as EngineName;
        const message = snapshot.val();
        const reducer = engines[engineName].reducer;
        const gs = reducer(room, message as any);
        room.gameState = gs;
        newState = gs.state;
        room.messages[context.params.key].read = true;
      }
      return room;
    });
    if (oldState !== newState) {
      for (const p of players) {
        await admin.database().ref(`/memberships/${p}/${context.params.id}`).update({
          lastUpdate: new Date().getTime(),
          isFinished: newState === ROOM_FINISHED_STATE,
        });
      }
    }
    if (newState === ROOM_FINISHED_STATE) {
      await snapshot.ref.parent!.parent!.update({
        _isFinished: true
      });
    }
});

export type GENERATION_FULFILLED_MSG_TYPE = "_GenerationFulfilled";
export const GENERATION_FULFILLED_MSG:GENERATION_FULFILLED_MSG_TYPE = "_GenerationFulfilled";

// We trigger this after the game state mutations because they're done 
// in a transaction and we don't want to accidentally retry API requests.
// Additionally they're much slower than other game state mutations.
export const generationRequest = functions
  .runWith({ secrets: ["OPENAI_API_KEY", "STABILITY_API_KEY", "AWS_ACCESS_KEY", "AWS_SECRET_KEY"] })
  .database.ref("/rooms/{roomId}/gameState/generations/{uid}")
  .onCreate(async (snapshot, context) => {
    // TODO (abuse prevention): check that the owner of the room is in good standing
    const apiReq = {
      ...snapshot.val(),
      room: context.params.roomId,
    } as GenerationRequest;
    functions.logger.log("*generate*", {request: apiReq, params: context.params});
    let result;
    try {
      result = await generate(apiReq);
    } catch(e) {
      result = {error: (e as Error).message};
    }
    const msgRef = await admin.database().ref(`/rooms/${apiReq.room}/messages`).push();
    await msgRef.set({
      type: GENERATION_FULFILLED_MSG,
      uid: context.params.uid,
    });
    return snapshot.ref.set({
      ...apiReq,
      ...result,
      fulfilled: true,
    });
});
