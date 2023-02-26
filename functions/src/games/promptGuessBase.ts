import * as functions from "firebase-functions";
import { chooseOne, chooseOneInObject, PGUtils, ROOM_FINISHED_STATE, ROOM_FINISHED_STATE_TYPE } from "../utils";
import { ModelDef, GenerationResponse } from "../generate";
import { GameCreateData } from "./games";

export type Template = {template: string, display: string};
export type GameDefinition = {
  engine: "PromptGuess",
  name: string,
  templates: { // Can't store an array in the db
    [k: string]: Template
  },
  model: ModelDef,
  introVideo: {
    url: string,
    durationSeconds: number,
  },
}
export type UserID = string; 
export type PromptGuessState = "Lobby" | "Intro" | "Prompt" | "Lie" | "Vote" | "Score" | ROOM_FINISHED_STATE_TYPE;
export type PlayerState = PromptGuessState;
export type PromptGeneration = GenerationResponse & {
  model: ModelDef,
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
  definition: GameDefinition,
  stateTransitions: Record<PromptGuessState, PromptGuessState>,
  gameState: {
    timer?: PromptGuessTimer,
    state: PromptGuessState,
    round: number,
    maxRound: number,
    currentGeneration: UserID | null,
    // Lies/votes/gens are optional because the timer may expire,
    // and Firebase doesn't store empty objects
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
      handle?: string,
      avatar?: string,
    }
  }
  history: { // Where we're going to store generations along with all context.
    [timestamp: number]: {
      generation: PromptGeneration,
      lies: { [k: UserID]: string },
      votes: { [k: UserID]: UserID },
    }
  }
  generationErrors: {
    [timestamp: number]: {
      generation: PromptGeneration,
    }
  }
}

const makeTimer = (timer: GameCreateData["timer"], videoDurS: number, gameScale = 1) => {
  if (timer !== "off") {
    const scale = (timer === "slow" ? 2000 : 1000) * gameScale;
    return {timer: { // This nesting is so we can spread it.
      started: 0,
      duration: 0,
      stateDurations: {
        "Lobby": Number.MAX_VALUE, // Needs all states for typing :/
        "Intro": videoDurS * 1000,
        "Prompt": 40 * scale,
        "Lie": 30 * scale,
        "Vote": 30 * scale,
        "Score": 30 * scale,
        [ROOM_FINISHED_STATE]: Number.MAX_VALUE
      },
    }};
  } else {
    return {};
  }
}

// In roomOpts we can even specify alternative models for the games. E.g. DALLE for Farsketched.
const init = (roomOpts: GameCreateData, def: GameDefinition): PromptGuessRoom => {
  const timer = makeTimer(roomOpts.timer, def.introVideo.durationSeconds);
  return {
    definition: def,
    stateTransitions: {
      "Lobby": "Intro",
      "Intro": "Prompt",
      "Prompt": "Lie",
      "Lie": "Vote",
      "Vote": "Score",
      "Score": "Prompt",
      [ROOM_FINISHED_STATE]: ROOM_FINISHED_STATE,
    },
    gameState: {
      ...timer,
      state: "Lobby",
      round: 1,
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
      [roomOpts._creator]: {
        state: "Lobby", 
        isPlayer: roomOpts.isPlayer,
        template: chooseOneInObject(def.templates),
        isReadyToContinue: false,
      }
    },
    history: {},
    generationErrors: {},
  }
}

type MessageType = "NewPlayer" | "Start" | "Prompt" | "Lie" | "Vote" | "Continue" | "OutOfTime" | "ReadyToContinue" | "GenerationError";
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
      template: chooseOneInObject(room.definition.templates),
      isReadyToContinue: false,
      isPlayer: message.isPlayer ?? true,
    }
  },

  Start(room: PromptGuessRoom) {
    functions.logger.log("PromptGuesser:Start");
    room.gameState.scores = {};
    Object.keys(room.players).forEach(k => {
      room.players[k].template = chooseOneInObject(room.definition.templates);
      room.gameState.scores[k] = {
        current: 0,
        previous: 0
      }
    });
    PromptGuesserActions.TransitionState(room, "Prompt");
  },

  chooseGeneration(room: PromptGuessRoom) {
    // Pick and set the generation.
    if (!room.gameState.generations) {
      return null;
    }
    const gens = Object.entries(room.gameState.generations);
    const noError = gens.filter(([_, g]) => !g.error);
    const fulfilled = noError.filter(([_, g]) => g.fulfilled);
    if (fulfilled.length > 0) { // Give something that's ready!
      return chooseOne(fulfilled)[0];
    } else if (noError.length > 0) {
      // This could still possibly error, and we get stuck.
      // How do we let people progress if the gen errored?
      // ***Send a message "GenerationError" which forces a repick.***
      return chooseOne(noError)[0];
    } else {
      // Move out the errored gens.
      room.generationErrors = room.generationErrors ?? {};
      gens.forEach(([k, g]) => {
        room.generationErrors[new Date().getTime()] = {
          generation: g
        };
        if (room.gameState.generations) {
          delete room.gameState.generations[k];
        }
      });
      return null;
    }
  },

  Prompt(room: PromptGuessRoom, message: PromptGuessMessage) {
    room.gameState.generations = room.gameState.generations ?? {};
    room.gameState.generations[message.uid] = {
      _context: {},
      uid: message.uid,
      prompt: message.value,
      template: room.players[message.uid]?.template || {template: "{1}", display: ""},
      model: room.definition.model,
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
          gameState.scores[scorePlayer].current += PGUtils.pointValues.authorOfTruthVote;
          gameState.scores[votePlayer].current += PGUtils.pointValues.votedTruth;
        } else if (v[votePlayer] === scorePlayer && 
                   gameState.currentGeneration !== scorePlayer) {
          gameState.scores[scorePlayer].current += PGUtils.pointValues.authorOfLieVote;
        }
      })
    })
  },

  setNextRoundOrFinish(room: PromptGuessRoom) {
    if (room.gameState.round < room.gameState.maxRound) {
      room.gameState.round += 1;
      Object.keys(room.players).forEach(k => {
        room.players[k].template = chooseOneInObject(room.definition.templates);
      });
      PromptGuesserActions.TransitionState(room, "Prompt");
    } else if (room.gameState.round === room.gameState.maxRound) {
      PromptGuesserActions.TransitionState(room, ROOM_FINISHED_STATE);
    }
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
        PromptGuesserActions.TransitionState(room, "Lie");
      } else {
        PromptGuesserActions.setNextRoundOrFinish(room);
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
    const allReady = Object.entries(room.players).every(([_, p]) => p.isReadyToContinue || !p.isPlayer);
    if (allReady && room.gameState.state === "Score") {
      PromptGuesserActions.ContinueAfterScoring(room);
    } else if (allReady && room.gameState.state === "Lobby" && room.definition.introVideo.url) {
      PromptGuesserActions.TransitionState(room, "Intro");
    } else if (allReady && room.gameState.state === "Lobby" && !room.definition.introVideo.url) {
      PromptGuesserActions.Start(room);
    } else if (allReady && room.gameState.state === "Intro") {
      PromptGuesserActions.Start(room);
    }
  },

  GenerationError(room: PromptGuessRoom) {
    // The client sends this when they're trying to view a generation which
    // hit an error. This can happen when the engine sets a current gen
    // which isn't fulfilled and it errors.
    const u = room.gameState.currentGeneration;
    if (u && room.gameState.generations && 
      room.gameState.generations[u] &&
      room.gameState.generations[u].error
    ) {
      // This is verbatim in TransitionState as well.
      const u = PromptGuesserActions.chooseGeneration(room);
      if (u) {
        room.gameState.currentGeneration = u;
      } else {
        PromptGuesserActions.setNextRoundOrFinish(room);
      }
    }
  },

  // All gameState.state transitions MUST happen through here if the game
  // is to function properly with the timer. We could enforce this by having
  // some private / protected methods. TODO: protect these state changes.
  TransitionState(room: PromptGuessRoom, newState: PromptGuessState) {
    const outOfTimeAndNoOneSubmittedPrompts = !room.gameState.generations && newState === "Lie";
    if (!outOfTimeAndNoOneSubmittedPrompts) {
      if (newState === "Lie") {
        const u = PromptGuesserActions.chooseGeneration(room);
        if (u) {
          room.gameState.currentGeneration = u;
        } else {
          PromptGuesserActions.setNextRoundOrFinish(room);
          // setNextRoundOrFinish calls TransitionState. Abort this call.
          return;
        }
      } else if (newState === "Score") {
        PromptGuesserActions.Score(room);
      }
      Object.keys(room.players).forEach(p => {
        room.players[p].state = newState;
        room.players[p].isReadyToContinue = false;
      });
      room.gameState.state = newState;
      if (room.gameState.timer && newState !== ROOM_FINISHED_STATE) {
        room.gameState.timer.duration = room.gameState.timer.stateDurations[newState];
        room.gameState.timer.started = new Date().getTime();
      }
    }
  }
}

function reducer(room: PromptGuessRoom, message: PromptGuessMessage): any {
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
  } else if (message.type === "GenerationError") {
    PromptGuesserActions.GenerationError(room);
  }
  return gameState
}

export const engine = {reducer, init};
