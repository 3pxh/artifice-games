import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

import { PromptGuesser, AnotherEngine } from "./games";

// import { GameNames } from "../../src/gameTypes";
// If we import this, the build folder (lib/) ends up looking like
// lib
//  |- functions/src/{index.js}
//  |- src/{gameTypes.js}
// And the build breaks, because we just want
// lib
//  |- index.js
// TODO: figure out how to import types across both.

admin.initializeApp();

type CreateRequest = {
  user: string,
  gameName: string,//GameNames,
}

export const roomCreated = functions.database.ref("/rooms/{id}")
  .onCreate((snapshot) => {
    const original = snapshot.val() as CreateRequest;
    functions.logger.log("Processing create request", original);
    const t = new Date().getTime();
    // TODO: get the default config for a game of type original.gameName
    return snapshot.ref.set({
      creator: original.user,
      gameName: original.gameName,
      startPing: t,
      createDate: t,
      inQueue: true,
      gameState: {state: 0},
      players: {
        [original.user]: {state: 0}
      },
    });
    
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
      return admin.database().ref(`/rooms/${context.params.id}/inQueue`).set(false);
    } else {
      // Someone's trying to skip the queue!
      return;
    }
});

type GameName = "farsketched" | "gisticle"; // | "dixit" | "codenames" | ...
type GameEngine = typeof PromptGuesser | typeof AnotherEngine;
const engines:Record<GameName, GameEngine> = {
  "farsketched": PromptGuesser,
  "gisticle": AnotherEngine,
}

export const roomMessaged = functions.database.ref("/rooms/{id}/messages")
  .onCreate((snapshot) => {
    const message = snapshot.val() as object;
    const messageId = Object.keys(message)[0]; // TODO: null guard
    functions.logger.log("Processing message", message);
    return snapshot.ref.parent!.transaction((v) => {
      if (v) {
        // TODO: Get the game type and choose the appropriate engine.
        const reducer = engines[v.gameName as GameName]
        // We need to run this computation in the transaction, or else two
        // transitions could be computed simultaneously, and one overwrite the other.
        const gs = reducer(v, message);
        v.gameState = gs;
        // TODO: schedule message deletion for the future
        // In the meantime, we'll leave it as a log.
        v.messages[messageId].read = true;
      }
      return v;
    })
});
