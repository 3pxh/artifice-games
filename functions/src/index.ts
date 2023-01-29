import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { generate, GenerationRequest } from "./generate";

import { engines, GameName, MessageTypes } from "./games/games";

admin.initializeApp();

type CreateRequest = {
  user: string,
  gameName: GameName,
}

export const roomCreated = functions.database.ref("/rooms/{id}")
  .onCreate((snapshot) => {
    const original = snapshot.val() as CreateRequest;
    functions.logger.log("Processing create request", {msg: original});
    const gameName = original.gameName as GameName;
    const gameRoom = engines[gameName].init(original.user);
    const t = new Date().getTime();
    const roomWithQueueState = {
      ...gameRoom,
      _startPing: t,
      _createDate: t,
      _inQueue: true,
      _creator: original.user,
      _initialized: true,
    }
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
    const apiReq = snapshot.val() as GenerationRequest;
    functions.logger.log("Processing generation", {apiReq});
    let result;
    try {
      result = await generate(apiReq);
    } catch(e) {
      result = {error: e};
    }
    functions.logger.log("promise fulfilled", {result});
    return snapshot.ref.set({
      ...apiReq,
      ...result,
      pending: false,
    });
});
