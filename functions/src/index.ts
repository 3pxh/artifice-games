import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { generate, GenerationRequest } from "./generate";
import App from "./app";

import { engines, MessageTypes, GameCreateData, EngineName } from "./games/games";

App.instance;

export type CreateRequest = {
  gameId: string, // Found in games/{gameId}
} & GameCreateData;

type GameData = {
  engine: EngineName,
  name: string,
}

type RoomState = {
  gameState: {state: string}
  players: {[uid: string]: any}
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
  functions.logger.log("Processing create request", { shortcode, roomId });
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
    functions.logger.log("Rooms in line", {n: activeRoomsInLine.length});
    return activeRoomsInLine.length;
  }
}

export const roomCreated = functions.database.ref("/rooms/{id}")
  .onCreate(async (snapshot, context) => {
    // TODO: Disallow creating many rooms at once.
    // Could be done via DB permissions.
    const msg = snapshot.val() as CreateRequest;
    functions.logger.log("Processing create request", {msg});
    // The database can store data that doesn't match types. How do we check it?
    const gameData = (await admin.database().ref(`/games/${msg.gameId}`).get()).val();
    if (!gameData) {
      functions.logger.error("roomCreated: Game not found", {msg});
      return snapshot.ref.set({
        error: `Game with id ${msg.gameId} not found!`
      });
    }
    functions.logger.log("Got game record", {gameData});
    const engineName:EngineName = (gameData as GameData).engine; // Or get from msg!
    const gameRoom = engines[engineName].init(msg, gameData as any); // TODO: typechecking on multiple games
    const t = new Date().getTime();
    const shortcode: string = await createShortcode(context.params.id);
    const roomWithQueueState = {
      ...gameRoom,
      _shortcode: shortcode,
      _startPing: t,
      _createDate: t,
      _queue: {
        inQueue: true,
        startTime: 0, 
      },
      _creator: msg._creator, // Used for administration in database.rules
      _initialized: true,
    } satisfies QueueRoom;
    const start = await roomStartTime(roomWithQueueState);
    roomWithQueueState._queue.startTime = start;
    return snapshot.ref.set(roomWithQueueState);
});

export const roomPingedToStart = functions.database.ref("/rooms/{id}/_startPing")
  .onUpdate(async (snapshot, context) => {
    functions.logger.log("Processing ping", snapshot.after.val());
    const thisRoom = (await snapshot.before.ref.parent?.get())?.val() as QueueRoom;
    // TODO: Account for abandoned rooms to speed up the queue.
    // This should work for now, but if 1000 people queue up, and then a bunch leave,
    // we probably want to notice they aren't pinging.
    // i.e. we could do a similar "roomStartTime" calculation
    // filtering out rooms not pinged in the past 2 minutes
    if (thisRoom._queue.startTime < new Date().getTime()) {
      return admin.database().ref(`/rooms/${context.params.id}/_queue/inQueue`).set(false);
    }
});

export const joinRequestCreated = functions.database.ref("/joinRequests/{uid}/{code}/{k}")
  .onCreate(async (snapshot, context) => {
    functions.logger.log("Processing join request", {val: snapshot.val()});
    const isPlayer = snapshot.val().isPlayer;
    let roomId;
    try {
      roomId = await getRoomFromShortcode(context.params.code);
    } catch (e) {
      functions.logger.log("Error getting the roomId");
    }
    if (!roomId) {
      return snapshot.ref.parent?.child("error").set("Room not found");
    }
    const room = (await admin.database().ref(`/rooms/${roomId}`).get()).val() as RoomState;
    const state = room.gameState.state;
    const players = Object.keys(room.players);
    // TODO: move this off of gameState and into room.hasStarted, and room.allowObservers
    // gameState should only ever be accessed by a game runner, and its schema should be
    // allowed to change only there.
    if (state === "Lobby" || players.find(p => p === context.params.uid)) {
      // TODO: also check if the game allows observers.
      // TODO: add relevant records for access control
      await admin.database().ref(`/rooms/${roomId}/messages`).push({
        type: "NewPlayer",
        uid: context.params.uid,
        isPlayer: isPlayer,
      });
      // The user's player key must exist when they try to access the room.
      await admin.database().ref(`/rooms/${roomId}/players/${context.params.uid}/_init`).set(true);
      return snapshot.ref.child("success").set({
        roomId,
        timestamp: new Date().getTime()
      });
    } else {
      return snapshot.ref.child("error").set(`Room is not in a Lobby, state: ${state}`);
    }
    // TODO: Clean up old join requests.
    // But since we create a new one each time, and adding a uid should be idempotent,
    // it's just a sanitation problem not a functionality problem.
});

export const roomMessaged = functions.database.ref("/rooms/{id}/messages/{key}")
  .onCreate((snapshot, context) => {
    // TODO: define write rules on the room --
    // if it's inQueue, then users can't write messages!
    // (They can only touch startPing)

    // TODO: If the room is currently queued, don't handle messages.

    // TODO: this should be a transaction on the gameState, not the room.
    // Players may be frequently changing their states under room/{id}/players
    // which could invalidate the transaction more than we'd like.
    return snapshot.ref.parent!.parent!.transaction((room) => {
      if (room) {
        functions.logger.log("Processing message", {msg: snapshot.val(), room: room, params: context.params});
        const engineName = room.definition.engine as EngineName;
        const message = snapshot.val() as MessageTypes[typeof engineName]; // Not sure abt this
        const reducer = engines[engineName].reducer;
        // We need to run this computation in the transaction, or else two
        // transitions could be computed simultaneously, and one oroomverwrite the other.
        // The only exception is the actual AI generation.
        const gs = reducer(room, message as any); // TODO: typechecking broken here.
        room.gameState = gs;
        // TODO: schedule deletion for the future, for now leave it as a log.
        room.messages[context.params.key].read = true;
      }
      return room;
    })
});

// We trigger this after the game state mutations because they're done 
// in a transaction and we don't want to accidentally retry API requests.
export const generationRequest = functions
  .runWith({ secrets: ["OPENAI_API_KEY", "STABILITY_API_KEY", "AWS_ACCESS_KEY", "AWS_SECRET_KEY"] })
  .database.ref("/rooms/{roomId}/gameState/generations/{uid}")
  .onCreate(async (snapshot, context) => {
    // TODO: check that the owner of the room is in good standing
    // And that we're willing to fulfill the request.
    // Another possibility: schedule the request to run after a delay.
    const apiReq = {
      ...snapshot.val(),
      room: context.params.roomId,
    } as GenerationRequest;
    functions.logger.log("Processing generation", {apiReq});
    let result;
    try {
      result = await generate(apiReq);
    } catch(e) {
      result = {error: (e as Error).message};
    }
    functions.logger.log("promise fulfilled", {result});
    return snapshot.ref.set({
      ...apiReq,
      ...result,
      fulfilled: true,
    });
});
