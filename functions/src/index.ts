import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

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
  .onCreate((snapshot, context) => {
    const original = snapshot.val() as CreateRequest;
    functions.logger.log("Processing create request", original);
    const t = new Date().getTime();
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
