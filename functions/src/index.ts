import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

import { engines, GameName, MessageTypes } from "./games/games";

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
      templates: [{template: "$1", display: "Write something"}],
      creator: original.user,
      gameName: original.gameName,
      startPing: t,
      createDate: t,
      inQueue: true,
      gameState: {
        state: "Lobby",
        // These disappear b/c firebase ignores empty dicts, so need to be null guarded.
        generations: {}, 
        lies: {},
        votes: {},
      },
      players: {
        [original.user]: {state: "Lobby"}
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



export const roomMessaged = functions.database.ref("/rooms/{id}/messages/{key}")
  .onCreate((snapshot, context) => {
    // TODO: check whether or not the room is in a queue.
    // Alternatively, define write rules on the room --
    // if it's inQueue, then users can't write messages!
    // (They can only touch startPing)
    return snapshot.ref.parent!.parent!.transaction((room) => {
      if (room) {
        functions.logger.log("Processing message", {msg: snapshot.val(), room: room, params: context.params});
        const gameName = room.gameName as GameName;
        const message = snapshot.val() as MessageTypes[typeof gameName]; // Not sure abt this
        const reducer = engines[gameName];
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
