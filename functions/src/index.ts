import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { generate, GenerationRequest } from "./generate";
import App from "./app";

import { engines, GameName, MessageTypes } from "./games/games";

App.instance;

type CreateRequest = {
  user: string,
  gameName: GameName,
}

type RoomState = {
  gameState: {state: string}
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

export type QueueRoom = {
  _shortcode: string,
  _startPing: number,
  _createDate: number,
  _inQueue: boolean,
  _creator: string,
  _initialized: boolean,
}

export const roomCreated = functions.database.ref("/rooms/{id}")
  .onCreate(async (snapshot, context) => {
    const original = snapshot.val() as CreateRequest;
    functions.logger.log("Processing create request", {msg: original});
    const gameName = original.gameName as GameName;
    const gameRoom = engines[gameName].init(original.user);
    const t = new Date().getTime();
    const shortcode: string = await createShortcode(context.params.id);
    const roomWithQueueState = {
      ...gameRoom,
      _shortcode: shortcode,
      _startPing: t,
      _createDate: t,
      _inQueue: true,
      _creator: original.user,
      _initialized: true,
    } satisfies QueueRoom;
    return snapshot.ref.set(roomWithQueueState);
});

export const roomPingedToStart = functions.database.ref("/rooms/{id}/startPing")
  .onUpdate((snapshot, context) => {
    functions.logger.log("Processing ping", snapshot.after.val());
    const now = new Date().getTime();
    if (snapshot.after.val() < now) {
      // TODO:
      // Determine if there is a queue and how long it is?
      // If there isn't, or the user is paid, jump the queue.
      // To start the game, initialize the game state.
      return admin.database().ref(`/rooms/${context.params.id}/_inQueue`).set(false);
    } else {
      // Someone's trying to skip the queue!
      return;
    }
});

export const joinRequestCreated = functions.database.ref("/joinRequests/{uid}/{code}/request")
  .onCreate(async (snapshot, context) => {
    functions.logger.log("Processing join request");
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
    // TODO: move this off of gameState and into room.hasStarted, and room.allowObservers
    // gameState should only ever be accessed by a game runner, and its schema should be
    // allowed to change only there.
    if (state === "Lobby") {
      // TODO: also check if the game allows observers.
      // TODO: add relevant records for access control
      await admin.database().ref(`/rooms/${roomId}/messages`).push({
        type: "NewPlayer",
        uid: context.params.uid,
      });
      return snapshot.ref.parent?.child("success").set({
        roomId,
        timestamp: new Date().getTime()
      });
      } else {
        return snapshot.ref.parent?.child("error").set(`Room is not in a Lobby, state: ${state}`);
      }
      // TODO: Clean up old join requests.
      // Because it's onCreate, if the user already used this code
      // then they aren't going to get the room. However, for 
      // re-joining it will be nice for them find success is already set.
});

export const roomMessaged = functions.database.ref("/rooms/{id}/messages/{key}")
  .onCreate((snapshot, context) => {
    // TODO: define write rules on the room --
    // if it's inQueue, then users can't write messages!
    // (They can only touch startPing)

    // TODO: this should be a transaction on the gameState, not the room.
    // Players may be frequently changing their states under room/{id}/players
    // which could invalidate the transaction more than we'd like.
    return snapshot.ref.parent!.parent!.transaction((room) => {
      if (room) {
        functions.logger.log("Processing message", {msg: snapshot.val(), room: room, params: context.params});
        const gameName = room.gameName as GameName;
        const message = snapshot.val() as MessageTypes[typeof gameName]; // Not sure abt this
        const reducer = engines[gameName].reducer;
        // We need to run this computation in the transaction, or else two
        // transitions could be computed simultaneously, and one oroomverwrite the other.
        // The only exception is the actual AI generation.
        const gs = reducer(room, message);
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
  .runWith({ secrets: ["OPENAI_API_KEY", "STABILITY_API_KEY"] })
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
