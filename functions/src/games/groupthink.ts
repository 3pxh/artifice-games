import * as functions from "firebase-functions";
import { shuffle, ROOM_FINISHED_STATE, ROOM_FINISHED_STATE_TYPE } from "../utils";
import { SDDef, GenerationResponse, GenerationRequest } from "../generate";
import { GameCreateData } from "./games";

export type GameDefinition = {
  engine: "GroupThink",
  name: string,
  numRounds: number,
  roundPrompts: { [k: number]: string },
  isHardcore: boolean,
  model: SDDef,
}
type UserID = string;
export type State = "Lobby" | "RoundPrompt" | "MakingImages" | "ViewingMasterpieces" | "Vote" | "Score" | ROOM_FINISHED_STATE_TYPE;
const STATE_TRANSITIONS:Record<State, State> = {
  "Lobby": "RoundPrompt",
  "RoundPrompt": "MakingImages",
  "MakingImages": "ViewingMasterpieces",
  "ViewingMasterpieces": "Vote",
  "Vote": "Score",
  "Score": "RoundPrompt",
  [ROOM_FINISHED_STATE]: ROOM_FINISHED_STATE,
}
export type Generation = Omit<GenerationRequest, "room"> & 
  GenerationResponse<string> & {
    model: SDDef,
    uid: string,
    fulfilled: boolean,
    error?: string,
  }
export type Timer = {
  started: number,
  duration: number,
  stateDurations: Record<State, number>,
}
export type Room = {
  definition: GameDefinition,
  stateTransitions: Record<State, State>,
  scratchpad: { // Designed for realtime sync, all players can write to it.
    input: string,
  },
  gameState: {
    timer?: Timer,
    state: State,
    round: number,
    numRounds: number,
    roundPromptPlayer: UserID,
    roundPrompt?: string,
    playerOrder?: { [k: number]: UserID },
    generations?: { [k: UserID]: Generation },
    votes?: { [k: UserID]: UserID },
    scores?: {
      [uid: UserID]: {
        current: number,
        previous: number,
      },
    },
  },
  players: { // Because we need to be able to set individual player data!
    [uid: UserID]: {
      state: State,
      isReadyToContinue: boolean,
      isPlayer: boolean,
      handle?: string,
      avatar?: string,
    }
  }
  history?: { // Where we're going to store generations along with all context.
    [timestamp: number]: {
      generation: Generation,
    }
  }
}

const makeTimer = (timer: GameCreateData["timer"]) => {
  if (timer !== "off") {
    const scale = (timer === "slow" ? 2000 : 1000);
    const STATE_DURATIONS:Timer["stateDurations"] = {
      "Lobby": Number.MAX_VALUE, // Needs all states for typing :/
      "RoundPrompt": 60 * scale,
      "MakingImages": 45 * scale,
      "ViewingMasterpieces": 5,
      "Vote": 90 * scale,
      "Score": 40,
      [ROOM_FINISHED_STATE]: Number.MAX_VALUE
    };
    return {timer: {
      started: 0,
      duration: 0,
      stateDurations: STATE_DURATIONS,
    }};
  } else {
    return {};
  }
}

const init = (roomOpts: GameCreateData, def: GameDefinition): Room => {
  const timer = makeTimer(roomOpts.timer);
  return {
    definition: def,
    stateTransitions: STATE_TRANSITIONS,
    scratchpad: {input: ""},
    gameState: {
      ...timer,
      state: "Lobby",
      roundPromptPlayer: roomOpts._creator,
      round: 1,
      numRounds: def.numRounds,
    },
    players: {
      [roomOpts._creator]: {
        state: "Lobby", 
        isPlayer: roomOpts.isPlayer,
        isReadyToContinue: false,
      }
    },
  }
}
type MessageType = "NewPlayer" | "ReadyToContinue" | "RoundPrompt" | "MakingImages" | "Vote" | "OutOfTime";
export type Message = {
  type: MessageType,
  uid: UserID,
  value: string,
  isPlayer?: boolean,
}

const Actions = {
  activePlayerCount(room: Room) {
    return Object.entries(room.players).filter(([k,p]) => p.isPlayer).length;
  },

  NewPlayer(room: Room, message: Message) {
    room.gameState.scores = room.gameState.scores ?? {};
    room.players[message.uid] = {
      state: room.gameState?.state ?? "Lobby",
      isReadyToContinue: false,
      isPlayer: message.isPlayer ?? true,
    }
    room.gameState.scores[message.uid] = room.gameState.scores[message.uid] ?? {current: 0, previous: 0};
  },

  RoundPrompt(room: Room, message: Message) {
    const scores = room.gameState.scores ?? {};
    Object.keys(room.players).forEach(p => {
      scores[p] = scores[p] ?? {current: 0, previous: 0}
    })
    room.gameState.roundPrompt = message.value;
    room.scratchpad.input = "";
    Actions.TransitionState(room, "MakingImages");
  },

  MakingImages(room: Room, message: Message) {
    room.gameState.generations = room.gameState.generations ?? {};
    room.gameState.generations[message.uid] = {
      _context: {},
      uid: message.uid,
      prompt: message.value,
      template: {template: "{1}"},
      model: room.definition.model,
      generation: "",
      fulfilled: false,
    };
    if (Object.keys(room.gameState.generations).length === Actions.activePlayerCount(room)) {
      Actions.TransitionState(room, "ViewingMasterpieces");
    }
  },

  Vote(room: Room, message: Message) {
    room.gameState.votes = room.gameState.votes ?? {};
    room.gameState.votes[message.uid] = message.value;
    if (Object.keys(room.gameState.votes).length === Actions.activePlayerCount(room)) {
      Actions.TransitionState(room, "Score");
    }
  },

  Score(room: Room) {
    const gameState = room.gameState;
    const votes = gameState.votes ?? {};
    const scores = gameState.scores ?? {};
    let maxVotes = 0;
    const reversedVotes = Object.entries(votes).reduce((acc, [_, v]) => {
      acc[v] = (acc[v] ?? 0) + 1;
      maxVotes = Math.max(maxVotes, acc[v]);
      return acc;
    }, {} as {[k: string]: number});
    const singleMax = Object.values(reversedVotes).filter(v => v === maxVotes).length === 1;
    const pointValues = Object.entries(reversedVotes).reduce((acc, [uid, v]) => {
      acc[uid] = v === (maxVotes && singleMax) ? 0 : v;
      return acc;
    }, {} as {[uid: string]: number});
    // Move current score to previous
    Object.entries(scores).forEach(([uid, v]) => {
      scores[uid].previous = v.current;
    });
    // We award the image generator
    Object.entries(pointValues).forEach(([uid, v]) => {
      scores[uid].current += v;
    })
    // We award the voters
    Object.keys(scores).forEach((uid) => {
      const vote = votes[uid];
      scores[uid].current += pointValues[vote];
    })
  },

  ContinueAfterScoring(room: Room) {
    const gameState = room.gameState;
    if (gameState.round < gameState.numRounds) {
      gameState.round++;
      delete room.gameState.roundPrompt;
      room.gameState.generations = {};
      room.gameState.votes = {};
      Actions.TransitionState(room, "RoundPrompt");
    } else {
      Actions.TransitionState(room, ROOM_FINISHED_STATE);
    }
  },

  OutOfTime(room: Room, message: Message) {
    const t = room.gameState.timer;
    const now = new Date().getTime();
    if (t && t.duration + t.started < now) { // Actually out of time
      const state = room.gameState.state;
      const autoTransitions:State[] = ["MakingImages", "Vote"];
      if (autoTransitions.includes(state)) {
        Actions.TransitionState(room, room.stateTransitions[room.gameState.state]);
      } else if (state === "Score") {
        Actions.ContinueAfterScoring(room);
      } else if (state === "ViewingMasterpieces" && room.gameState.generations) {
        // Check that every player's generation is fulfilled
        const allFulfilled = Object.entries(room.gameState.generations).every(([_, g]) => g.fulfilled);
        if (allFulfilled) {
          Actions.TransitionState(room, "Vote");
        }
      }
    }
  },

  ReadyToContinue(room: Room, message: Message) {
    room.players[message.uid].isReadyToContinue = true;
    // If everyone is ready, we want to transition.
    const allReady = Object.entries(room.players).every(([k, p]) => p.isReadyToContinue || !p.isPlayer);
    if (allReady && room.gameState.state === "Score") {
      Actions.ContinueAfterScoring(room);
    } else if (allReady && room.gameState.state === "Lobby") {
      Actions.TransitionState(room, "RoundPrompt");
    } else if (allReady && room.gameState.state === "ViewingMasterpieces") {
      Actions.TransitionState(room, "Vote");
    }
  },

  // All gameState.state transitions MUST happen through here if the game
  // is to function properly with the timer. We could enforce this by having
  // some private / protected methods. TODO: protect these state changes.
  TransitionState(room: Room, newState: State) {
    if (newState === "RoundPrompt") {
      const playerOrder: {[k: number]: UserID} = {};
      shuffle(Object.keys(room.players)).forEach((p, i) => playerOrder[i] = p);
      room.gameState.playerOrder = room.gameState.playerOrder ?? playerOrder;
      room.gameState.roundPromptPlayer = room.gameState.playerOrder[room.gameState.round % Object.keys(room.gameState.playerOrder).length];
    } else if (newState === "Score" && room.gameState.generations) {
      Actions.Score(room);
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

function reducer(room: Room, message: Message): any {
  functions.logger.log("groupthink, reducing", {msg: message, gameState: room.gameState});
  const gameState = room.gameState;
  if (message.type === "NewPlayer") {
    Actions.NewPlayer(room, message);
  } else if (message.type === gameState.state || message.type === "ReadyToContinue") {
    Actions[message.type](room, message);
  } else if (message.type === "OutOfTime") {
    Actions.OutOfTime(room, message);
  }
  return gameState
}

export const engine = {reducer, init};
