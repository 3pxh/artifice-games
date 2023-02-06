import * as functions from "firebase-functions";
import { chooseOne } from "../utils";
import { Models, GenerationResponse } from "../generate";
import { GameCreateData } from "./games";

export type Template = {template: string, display: string};
export type UserID = string; 
export type PromptGuessState = "Lobby" | "Intro" | "Prompt" | "Lie" | "Vote" | "Score" | "Finish";
export type PlayerState = PromptGuessState | "PromptDone" | "LieDone" | "VoteDone";
export type PromptGeneration = GenerationResponse & {
  model: Models,
  uid: UserID,
  prompt: string,
  template: Template,
  fulfilled: boolean,
  error?: string,
}
export type PromptGuessTimer = {
  started: number,
  duration: number,
  stateDurations: Record<PromptGuessState, number>,
}
export type PromptGuessGameName = "farsketched" | "gisticle" | "tresmojis"
export type PromptGuessRoom = {
  gameName: PromptGuessGameName,
  introVideoUrl?: string,
  templates: Template[],
  model: "StableDiffusion" | "GPT3",
  stateTransitions: Record<PromptGuessState, PromptGuessState>,
  gameState: {
    timer?: PromptGuessTimer,
    state: PromptGuessState,
    round: number,
    maxRound: number,
    currentGeneration: UserID | null,
    // Lies/votes/gens are optional because the timer may expire.
    lies?: { [k: UserID]: string },
    votes?: { [k: UserID]: UserID },
    generations?: { [k: UserID]: PromptGeneration },
    scores: {
      [k: UserID]: {
        current: number,
        previous: number,
      },
    },
  },
  players: { // Because we need to be able to set individual player data!
    [uid: UserID]: {
      state: PlayerState,
      template: Template,
      isReadyToContinue: boolean,
      isPlayer: boolean,
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

// In roomOpts we can even specify alternative models for the games. E.g. DALLE for Farsketched.
export const initState = (roomOpts?: GameCreateData): PromptGuessRoom => {
  return {
    gameName: "farsketched", // This feels a bit wrong.
    templates: [{template: "{1}", display: "Write something"}],
    model: "StableDiffusion",
    stateTransitions: {
      "Lobby": "Intro",
      "Intro": "Prompt",
      "Prompt": "Lie",
      "Lie": "Vote",
      "Vote": "Score",
      "Score": "Prompt",
      "Finish": "Finish",
    },
    gameState: {
      state: "Lobby",
      round: 0,
      maxRound: 3,
      currentGeneration: null,
      // These disappear b/c firebase ignores empty dicts, so need to be null guarded.
      generations: {}, 
      lies: {},
      votes: {},
      scores: {},
    },
    players: {
      // This is initialized with the owner in each game's init()
    },
    history: {},
  }
}

type MessageType = "NewPlayer" | "Start" | "Prompt" | "Lie" | "Vote" | "Continue" | "OutOfTime" | "ReadyToContinue";
export type PromptGuessMessage = {
  type: MessageType,
  uid: UserID,
  value: UserID | string,
  template?: Template,
  isPlayer?: boolean,
}

// TODO: type enforcement on room actions. We probably want public and private actions
// to be separated. Some thoughts here if they were all lumped together:
// type InternalActions = "TransitionState" | "Score" | "ContinueAfterScoring";
// type ActionType = Record<MessageType & InternalActions, (room: PromptGuessRoom, message: PromptGuessMessage) => void>;
// const PromptGuesserActions:ActionType = {
const PromptGuesserActions = {
  ActivePlayerCount(room: PromptGuessRoom) {
    return Object.entries(room.players).filter(([k,p]) => p.isPlayer).length;
  },

  NewPlayer(room: PromptGuessRoom, message: PromptGuessMessage) {
    functions.logger.log("PromptGuesser:NewPlayer");
    room.players[message.uid] = {
      state: "Lobby",
      template: chooseOne(room.templates),
      isReadyToContinue: false,
      isPlayer: message.isPlayer ?? true,
    }
  },

  Start(room: PromptGuessRoom) {
    functions.logger.log("PromptGuesser:Start");
    room.gameState.scores = {};
    Object.keys(room.players).forEach(k => {
      room.players[k].template = chooseOne(room.templates);
      room.gameState.scores[k] = {
        current: 0,
        previous: 0
      }
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
      _context: {},
      uid: message.uid,
      prompt: message.value,
      template: room.players[message.uid]?.template || {template: "{1}", display: ""},
      model: room.model,
      generation: "",
      fulfilled: false,
    };
    // How are we handling player presence? Do we want to check the nPlayers,
    // or perhaps iterate over room.players and check how many are present?
    // If using onDisconnect we might be able to notice disconnections.
    if (Object.keys(room.gameState.generations).length === PromptGuesserActions.ActivePlayerCount(room)) {
      PromptGuesserActions.TransitionState(room, "Lie");
    }
  },

  Lie(room: PromptGuessRoom, message: PromptGuessMessage) {
    room.gameState.lies = room.gameState.lies ?? {};
    room.gameState.lies[message.uid] = message.value;
    // For all of these checks, we also need to be able to do it
    // based on the timer. Which means we will pull them out of here.
    if (Object.keys(room.gameState.lies).length === PromptGuesserActions.ActivePlayerCount(room) - 1) {
      PromptGuesserActions.TransitionState(room, "Vote");
    }
  },

  Vote(room: PromptGuessRoom, message: PromptGuessMessage) {
    room.gameState.votes = room.gameState.votes ?? {};
    room.gameState.votes[message.uid] = message.value;
    if (Object.keys(room.gameState.votes).length === PromptGuesserActions.ActivePlayerCount(room) - 1) {
      PromptGuesserActions.TransitionState(room, "Score");
    }
  },

  Score(room: PromptGuessRoom) {
    const gameState = room.gameState;
    Object.keys(gameState.scores).forEach(scorePlayer => {
      gameState.scores[scorePlayer].previous = gameState.scores[scorePlayer].current;
    });
    Object.keys(gameState.scores).forEach(scorePlayer => {
      const v = gameState.votes ?? {};
      Object.keys(v).forEach(votePlayer => {
        if (v[votePlayer] === scorePlayer && 
            gameState.currentGeneration === scorePlayer) {
          // You wrote the truth and someone guessed it
          gameState.scores[scorePlayer].current += 1000;
          gameState.scores[votePlayer].current += 1000;
        } else if (v[votePlayer] === scorePlayer && 
                   gameState.currentGeneration !== scorePlayer) {
          // You wrote a lie and someone guessed it
          gameState.scores[scorePlayer].current += 500;
        }
      })
    })
  },

  ContinueAfterScoring(room: PromptGuessRoom) {
    const gameState = room.gameState;
    if (gameState.currentGeneration && gameState.generations) {
      // It's really annoying Firebase won't hold empty objects.
      // Perhaps we should use a "safeSet" function for all object properties.
      room.history = room.history || {};
      room.history[new Date().getTime()] = {
        // TODO: do we have to deep copy these?
        generation: gameState.generations[gameState.currentGeneration],
        lies: gameState.lies ?? {},
        votes: gameState.votes ?? {},
      };
      gameState.lies = {};
      gameState.votes = {};
      delete gameState.generations[gameState.currentGeneration];
      const gens = Object.keys(gameState.generations);
      if (gens.length > 0) {
        gameState.currentGeneration = chooseOne(gens);
        PromptGuesserActions.TransitionState(room, "Lie");
      } else if (gens.length === 0 && room.gameState.round < room.gameState.maxRound) {
        room.gameState.round += 1;
        Object.keys(room.players).forEach(k => {
          room.players[k].template = chooseOne(room.templates);
        });
        PromptGuesserActions.TransitionState(room, "Prompt");
      } else if (gens.length === 0 && room.gameState.round === room.gameState.maxRound) {
        PromptGuesserActions.TransitionState(room, "Finish");
      }
    } else {
      // we shouldn't have gotten here...
    }
  },

  OutOfTime(room: PromptGuessRoom, message: PromptGuessMessage) {
    const t = room.gameState.timer;
    const now = new Date().getTime();
    if (t && t.duration + t.started < now) { // Actually out of time
      const state = room.gameState.state;
      const autoTransitions:PromptGuessState[] = ["Intro", "Prompt", "Lie", "Vote"];
      if (autoTransitions.includes(state)) {
        PromptGuesserActions.TransitionState(room, room.stateTransitions[room.gameState.state]);
      } else if (state === "Score") {
        PromptGuesserActions.ContinueAfterScoring(room);
      }
    }
  },

  ReadyToContinue(room: PromptGuessRoom, message: PromptGuessMessage) {
    room.players[message.uid].isReadyToContinue = true;
    // If everyone is ready, we want to transition.
    if (Object.entries(room.players).every(([k, p]) => p.isReadyToContinue) &&
        room.gameState.state === "Score") {
      PromptGuesserActions.ContinueAfterScoring(room);
    }
  },

  // All gameState.state transitions MUST happen through here if the game
  // is to function properly with the timer. We could enforce this by having
  // some private / protected methods. TODO: protect these state changes.
  TransitionState(room: PromptGuessRoom, newState: PromptGuessState) {
    const outOfTimeAndNoOneSubmittedPrompts = !room.gameState.generations && newState === "Lie";
    if (!outOfTimeAndNoOneSubmittedPrompts) {
      if (newState === "Lie" && room.gameState.generations) {
        const gens = Object.keys(room.gameState.generations);
        room.gameState.currentGeneration = chooseOne(gens);
      } else if (newState === "Score") {
        PromptGuesserActions.Score(room);
      }
      Object.keys(room.players).forEach(p => {
        room.players[p].state = newState;
        room.players[p].isReadyToContinue = false;
      });
      room.gameState.state = newState;
      if (room.gameState.timer && newState !== "Finish") {
        room.gameState.timer.duration = room.gameState.timer.stateDurations[newState];
        room.gameState.timer.started = new Date().getTime();
      }
    }
  }
}

export function PromptGuesser(room: PromptGuessRoom, message: PromptGuessMessage): any {
  functions.logger.log("Prompt Guesser, reducing", {msg: message, gameState: room.gameState});
  const gameState = room.gameState;
  if (message.type === "NewPlayer" && gameState.state === "Lobby") {
    // Alternatively if the room allows spectators
    PromptGuesserActions.NewPlayer(room, message);
  } else if (message.type === "Start" && gameState.state === "Lobby") {
    PromptGuesserActions.Start(room);
  } else if (message.type === gameState.state || message.type === "ReadyToContinue") { // Prompt, Lie, Vote
    PromptGuesserActions[message.type](room, message);
  } else if (message.type === "Continue" && gameState.state === "Score") {
    PromptGuesserActions.ContinueAfterScoring(room);
  } else if (message.type === "OutOfTime") {
    PromptGuesserActions.OutOfTime(room, message);
  }
  return gameState
}