import * as functions from "firebase-functions";
import { chooseOne } from "../utils";

type Template = {template: string, display: string};
type UserID = string; 
export type PromptGuessState = "Lobby" | "Prompt" | "Lie" | "Vote" | "Score" | "Finish";
export type PlayerState = PromptGuessState | "PromptDone" | "LieDone" | "VoteDone";
export type PromptGeneration = {
  type: string,
  uid: UserID,
  prompt: string,
  template: Template,
  value: string,
}
export type PromptGuessRoom = {
  templates: Template[],
  round: number,
  maxRound: number,
  nPlayers: number,
  model: "StableDiffusion" | "GPT3",
  stateTransitions: Record<PromptGuessState, PromptGuessState>,
  gameState: {
    timer?: {
      started: number,
      duration: number,
      stateDurations: Record<PromptGuessState, number>,
    },
    state: PromptGuessState,
    currentGeneration: UserID,
    lies: { [k: UserID]: string },
    votes: { [k: UserID]: UserID },
    scores: {
      [k: UserID]: {
        current: number,
        previous: number,
      },
    },
    generations: { [k: UserID]: PromptGeneration },
  },
  players: { // Because we need to be able to set individual player data!
    [uid: UserID]: {
      state: PlayerState,
      template: Template,
    }
  }
  history: { // Where we're going to store generations along with all context.
    [timestamp: number]: {
      generation: PromptGeneration,
      lies: { [k: UserID]: string },
      votes: { [k: UserID]: UserID },
    }
  }
}

export type PromptGuessMessage = {
  type: "Start" | "Prompt" | "Lie" | "Vote" | "Continue" | "OutOfTime",
  uid: UserID,
  value: UserID | string,
  template?: Template,
}

const PromptGuesserActions = {
  Start(room: PromptGuessRoom) {
    functions.logger.log("PromptGuesser:Start");
    Object.keys(room.players).forEach(k => {
      room.players[k].template = chooseOne(room.templates);
    });
    PromptGuesserActions.TransitionState(room, "Prompt");
  },

  Prompt(room: PromptGuessRoom, message: PromptGuessMessage) {
    // TODO: run the actual generator!
    // Ah shit, do we need to do that outside of the transaction and pass the result in?
    // If it's inside the transaction and the transaction fails (bc another write occurred)
    // then it'll retry, and hit the expensive API again (and take a long time!).
    room.gameState.generations = room.gameState.generations ?? {};
    room.gameState.generations[message.uid] = {
      uid: message.uid,
      prompt: message.value,
      template: message.template || {template: "{1}", display: ""},
      type: "text",
      value: "whatever GPT3 said or URL after running SD",
    };
    // How are we handling player presence? Do we want to check the nPlayers,
    // or perhaps iterate over room.players and check how many are present?
    // If using onDisconnect we might be able to notice disconnections.
    if (Object.keys(room.gameState.generations).length === Object.keys(room.players).length) {
      const gens = Object.keys(room.gameState.generations);
      room.gameState.currentGeneration = chooseOne(gens);
      PromptGuesserActions.TransitionState(room, "Lie");
    }
  },

  Lie(room: PromptGuessRoom, message: PromptGuessMessage) {
    room.gameState.lies = room.gameState.lies ?? {};
    room.gameState.lies[message.uid] = message.value;
    // For all of these checks, we also need to be able to do it
    // based on the timer. Which means we will pull them out of here.
    if (Object.keys(room.gameState.generations).length === Object.keys(room.players).length - 1) {
      PromptGuesserActions.TransitionState(room, "Vote");
    }
  },

  Vote(room: PromptGuessRoom, message: PromptGuessMessage) {
    room.gameState.votes = room.gameState.votes ?? {};
    room.gameState.votes[message.uid] = message.value;
    if (Object.keys(room.gameState.generations).length === Object.keys(room.players).length - 1) {
      PromptGuesserActions.Score(room, message);
      PromptGuesserActions.TransitionState(room, "Score");
    }
  },

  Score(room: PromptGuessRoom, message: PromptGuessMessage) {
    const gameState = room.gameState;
    Object.keys(gameState.scores).forEach(scorePlayer => {
      gameState.scores[scorePlayer].previous = gameState.scores[scorePlayer].current;
      Object.keys(gameState.votes).forEach(votePlayer => {
        if (gameState.votes[votePlayer] === scorePlayer && 
            gameState.currentGeneration === scorePlayer) {
          // You wrote the truth and someone guessed it
          gameState.scores[scorePlayer].current += 1000;
          gameState.scores[votePlayer].current += 1000;
        } else if (gameState.votes[votePlayer] === scorePlayer && 
                   gameState.currentGeneration !== scorePlayer) {
          // You wrote a lie and someone guessed it
          gameState.scores[scorePlayer].current += 500;
        }
      })
    })
  },

  ContinueAfterScoring(room: PromptGuessRoom, message: PromptGuessMessage) {
    const gameState = room.gameState;
    room.history[new Date().getTime()] = {
      // TODO: do we have to deep copy these?
      generation: gameState.generations[gameState.currentGeneration],
      lies: gameState.lies,
      votes: gameState.votes,
    };
    gameState.lies = {};
    gameState.votes = {};
    delete gameState.generations[gameState.currentGeneration];
    const gens = Object.keys(gameState.generations);
    if (gens.length > 0) {
      gameState.currentGeneration = chooseOne(gens);
      PromptGuesserActions.TransitionState(room, "Lie");
    } else if (gens.length === 0 && room.round < room.maxRound) {
      PromptGuesserActions.TransitionState(room, "Prompt");
    } else if (gens.length === 0 && room.round === room.maxRound) {
      gameState.state = "Finish";
    }
  },

  ContinueByTimer(room: PromptGuessRoom, message: PromptGuessMessage) {
    const t = room.gameState.timer;
    const now = new Date().getTime();
    if (t && t.duration + t.started < now) { // Out of time
      PromptGuesserActions.TransitionState(room, room.stateTransitions[room.gameState.state]);
    }
  },

  TransitionState(room: PromptGuessRoom, s: PromptGuessState) {
    // Handles setting the game state along with resetting the timer.
    Object.keys(room.players).forEach(p => {
      room.players[p].state = s;
    })
    room.gameState.state = s;
    if (room.gameState.timer) {
      room.gameState.timer.duration = room.gameState.timer.stateDurations[s];
      room.gameState.timer.started = new Date().getTime();
    }
  }
}

export function PromptGuesser(room: PromptGuessRoom, message: PromptGuessMessage): any {
  functions.logger.log("Prompt Guesser, reducing", {msg: message, gameState: room.gameState});
  const gameState = room.gameState;
  if (message.type === "Start" && gameState.state === "Lobby") {
    PromptGuesserActions.Start(room);
  } else if (message.type === gameState.state) { // Prompt, Lie, Vote
    PromptGuesserActions[message.type](room, message);
  } else if (message.type === "Continue" && gameState.state === "Score") {
    PromptGuesserActions.ContinueAfterScoring(room, message);
  } else if (message.type === "OutOfTime") {
    PromptGuesserActions.ContinueByTimer(room, message);
  }
  return gameState
}