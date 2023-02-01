import * as functions from "firebase-functions";
import { chooseOne } from "../utils";
import { Models } from "../generate";

export type Template = {template: string, display: string};
export type UserID = string; 
export type PromptGuessState = "Lobby" | "Intro" | "Prompt" | "Lie" | "Vote" | "Score" | "Finish";
export type PlayerState = PromptGuessState | "PromptDone" | "LieDone" | "VoteDone";
export type PromptGeneration = {
  model: Models,
  uid: UserID,
  prompt: string,
  template: Template,
  value: string,
  pending: boolean,
  error?: string,
}
type PromptGuessTimer = {
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

// TODO: define roomOpts -- e.g. how fast is the timer, is it a shared display, etc.
// We can even specify alternative models for the games. E.g. DALLE for Farsketched.
export const initState = (roomOpts?: any): PromptGuessRoom => {
  let timer:{timer: PromptGuessTimer} | null = null;
  if (roomOpts && roomOpts.timer) {
    timer = {timer: { // This nesting is so we can spread it.
      started: 0,
      duration: 0,
      stateDurations: {
        "Lobby": Number.MAX_VALUE, // Needs all states for typing :/
        "Intro": 132 * 1000, //Farsketched video is 128 seconds.
        // TODO: parametrize these by timer options, player count, etc.
        // Move timer initialization into its own function.
        // We may want to override it per game as well.
        "Prompt": 40 * 1000,
        "Lie": 30 * 1000,
        "Vote": 30 * 1000,
        "Score": 30 * 1000,
        "Finish": Number.MAX_VALUE
      },
    }};
  }
  return {
    ...(timer || {}),
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

export type PromptGuessMessage = {
  type: "NewPlayer" | "Start" | "Prompt" | "Lie" | "Vote" | "Continue" | "OutOfTime",
  uid: UserID,
  value: UserID | string,
  template?: Template,
}

const PromptGuesserActions = {
  NewPlayer(room: PromptGuessRoom, message: PromptGuessMessage) {
    functions.logger.log("PromptGuesser:NewPlayer");
    room.players[message.uid] = {
      state: "Lobby",
      template: chooseOne(room.templates)
    }
  },

  Start(room: PromptGuessRoom) {
    functions.logger.log("PromptGuesser:Start");
    // When do we set the players?
    // room.players = room.players ?? {};
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
      template: room.players[message.uid]?.template || {template: "{1}", display: ""},
      model: room.model,
      value: "",
      pending: true,
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
    if (Object.keys(room.gameState.lies).length === Object.keys(room.players).length - 1) {
      PromptGuesserActions.TransitionState(room, "Vote");
    }
  },

  Vote(room: PromptGuessRoom, message: PromptGuessMessage) {
    room.gameState.votes = room.gameState.votes ?? {};
    room.gameState.votes[message.uid] = message.value;
    if (Object.keys(room.gameState.votes).length === Object.keys(room.players).length - 1) {
      PromptGuesserActions.Score(room, message);
      PromptGuesserActions.TransitionState(room, "Score");
    }
  },

  Score(room: PromptGuessRoom, message: PromptGuessMessage) {
    const gameState = room.gameState;
    gameState.scores = gameState.scores ?? {};
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
    if (gameState.currentGeneration) {
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
      } else if (gens.length === 0 && room.gameState.round < room.gameState.maxRound) {
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
        PromptGuesserActions.ContinueAfterScoring(room, message);
      }
    }
  },

  // All gameState.state transitions MUST happen through here if the game
  // is to function properly with the timer. We could enforce this by having
  // some private / protected methods. TODO: protect these state changes.
  TransitionState(room: PromptGuessRoom, newState: PromptGuessState) {
    Object.keys(room.players).forEach(p => {
      room.players[p].state = newState;
    });
    room.gameState.state = newState;
    if (room.gameState.timer && newState !== "Finish") {
      room.gameState.timer.duration = room.gameState.timer.stateDurations[newState];
      room.gameState.timer.started = new Date().getTime();
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
  } else if (message.type === gameState.state) { // Prompt, Lie, Vote
    PromptGuesserActions[message.type](room, message);
  } else if (message.type === "Continue" && gameState.state === "Score") {
    PromptGuesserActions.ContinueAfterScoring(room, message);
  } else if (message.type === "OutOfTime") {
    PromptGuesserActions.OutOfTime(room, message);
  }
  return gameState
}