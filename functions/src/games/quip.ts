import * as functions from "firebase-functions";
import { ROOM_FINISHED_STATE, ROOM_FINISHED_STATE_TYPE, chooseOneInObject } from "../utils";
import { ChatGPTDef, GenerationResponse, GenerationRequest } from "../generate";
import { GameCreateData } from "./games";

export type GameDefinition = {
  engine: "Quip",
  name: string,
  model: ChatGPTDef,
  introVideo: {
    url: string,
    durationSeconds: number,
  },
  promptPreface: string,
  systemPreface: string,
  roundPrompts: {
    [k: number]: string
  }
}
type UserID = string;
export type State = "Lobby" | "Intro" | "Input" | "ShowResults" | "Score" | ROOM_FINISHED_STATE_TYPE;
const STATE_TRANSITIONS:Record<State, State> = {
  "Lobby": "Intro",
  "Intro": "Input",
  "Input": "ShowResults",
  "ShowResults": "Score",
  "Score": "Input",
  [ROOM_FINISHED_STATE]: ROOM_FINISHED_STATE,
}
export type Generation = Omit<GenerationRequest, "room" | "template" | "prompt"> & 
  GenerationResponse & {
    model: ChatGPTDef,
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
  gameState: {
    timer?: Timer,
    state: State,
    round: number,
    roundPrompt: string,
    promptPreface: string,
    systemPreface: string,
    maxRound: number,
    quips?: { [k: UserID]: string },
    generations?: { [k: UserID]: Generation },
    scores?: {
      [uid: UserID]: {
        current: number
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

const makeTimer = (timer: GameCreateData["timer"], videoDurS: number, gameScale = 1) => {
  if (timer !== "off") {
    const scale = (timer === "slow" ? 2000 : 1000) * gameScale;
    const STATE_DURATIONS:Timer["stateDurations"] = {
      "Lobby": Number.MAX_VALUE, // Needs all states for typing :/
      "Intro": videoDurS * 1000,
      "Input": 30 * scale,
      "ShowResults": 30 * scale,
      "Score": 30 * scale,
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
  const timer = makeTimer(roomOpts.timer, def.introVideo.durationSeconds);
  return {
    definition: def,
    stateTransitions: STATE_TRANSITIONS,
    gameState: {
      ...timer,
      state: "Lobby",
      roundPrompt: chooseOneInObject(def.roundPrompts),
      promptPreface: def.promptPreface,
      systemPreface: def.systemPreface,
      round: 1,
      maxRound: 7,
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
type MessageType = "Intro" | "Input" | 
  "NewPlayer" | "OutOfTime" | "ReadyToContinue";
export type Message = {
  type: MessageType,
  uid: UserID,
  value: string,
  isPlayer?: boolean,
}
export type GenerationSchema = {
  better: string,
  reason: string
}
const MAX_PLAYERS = 2;

const Actions = {
  activePlayerCount(room: Room) {
    return Object.entries(room.players).filter(([_,p]) => p.isPlayer).length;
  },

  NewPlayer(room: Room, message: Message) {
    functions.logger.log("AIJudge:NewPlayer");
    room.gameState.scores = room.gameState.scores ?? {};
    if (Actions.activePlayerCount(room) < MAX_PLAYERS || !message.isPlayer) {
      room.players[message.uid] = {
        state: room.gameState?.state ?? "Lobby",
        isReadyToContinue: false,
        isPlayer: message.isPlayer ?? true,
      }
      room.gameState.scores[message.uid] = room.gameState.scores[message.uid] ?? {current: 0};
    }
  },

  Intro(room: Room) {
    room.gameState.scores = {};
    Object.keys(room.players).forEach(k => {
      room.gameState.scores![k] = {
        current: 0
      }
    });
    Actions.TransitionState(room, "Input");
  },

  Input(room: Room, message: Message) {
    room.gameState.quips = room.gameState.quips ?? {};
    room.gameState.quips[message.uid] = message.value;
    if (Object.keys(room.gameState.quips).length === Actions.activePlayerCount(room)) {
      Actions.generate(room);
      Actions.TransitionState(room, "ShowResults");
    }
  },

  generate(room: Room) {
    const gs = room.gameState;
    if (gs.quips) {
      gs.generations = {};
      const letters = "AB";
      // Sort by player uid to know which is A or B when scoring
      const playerPrompts = Object.entries(gs.quips).sort(([uid, _],[uid2, __]) => {
        return uid < uid2 ? -1 : 1;
      }).map(([_, q], i) => {
        return `${letters.charAt(i)}: ${q}`;
      }).join('\n');
      const schema = {better: "the letter 'A' or 'B'", reason: "string"};
      const schemaTypes:GenerationSchema = {better: "string", reason: "string"};
      const formatPrompt = `\n\nGive output in the form ${JSON.stringify(schema)}. Begin your output with "{"`
      gs.generations["_engine"] = {
        _context: {},
        uid: "_engine",
        chatGPTParams: {
          messages: [
            {role: "system", content: room.gameState.systemPreface},
            {role: "user", content: `${room.gameState.promptPreface}\n\n${room.gameState.roundPrompt}\n\n${playerPrompts}\n\n${formatPrompt}`},
          ],
          schema: schemaTypes
        },
        model: room.definition.model,
        generation: "",
        fulfilled: false,
      } as Generation;
    }
  },


  ShowResults(room: Room, message: Message) {
  },

  Score(room: Room) {
    const gs = room.gameState;
    // See what the generation produced and give that player a point.
    if (gs.generations && gs.quips && gs.scores) {
      const letters = "AB";
      const g = gs.generations["_engine"].generation as {better: string, reason: string};
      const pickUid = Object.keys(gs.quips).sort((uid,uid2) => {
        return uid < uid2 ? -1 : 1;
      }).find((_, i) => {
        return letters.charAt(i) === g.better;
      });
      if (pickUid) {
        gs.scores[pickUid].current += 1;
      }
    }
  },

  ContinueAfterScoring(room: Room) {
    room.gameState.roundPrompt = chooseOneInObject(room.definition.roundPrompts);
    if (room.gameState.round < room.gameState.maxRound) {
      room.gameState.round += 1;
      Actions.TransitionState(room, "Input");
    } else {
      Actions.TransitionState(room, ROOM_FINISHED_STATE);
    }
  },

  OutOfTime(room: Room, message: Message) {
    // const t = room.gameState.timer;
    // const now = new Date().getTime();
    // if (t && t.duration + t.started < now) { // Actually out of time
    //   const state = room.gameState.state;
    //   const autoTransitions:State[] = ["Intro", "Answer", "Question"];
    //   if (autoTransitions.includes(state)) {
    //     Actions.TransitionState(room, room.stateTransitions[room.gameState.state]);
    //   } else if (state === "Score") {
    //     Actions.ContinueAfterScoring(room);
    //   }
    // }
  },

  ReadyToContinue(room: Room, message: Message) {
    room.players[message.uid].isReadyToContinue = true;
    // If everyone is ready, we want to transition.
    const allReady = Object.entries(room.players).every(([k, p]) => p.isReadyToContinue || !p.isPlayer);
    if (allReady && room.gameState.state === "ShowResults") {
      Actions.Score(room);
      Actions.TransitionState(room, "Score");
    } else if (allReady && room.gameState.state === "Score") {
      Actions.ContinueAfterScoring(room);
    } else if (allReady && room.gameState.state === "Lobby" && room.definition.introVideo.url) {
      Actions.TransitionState(room, "Intro");
    } else if (allReady && room.gameState.state === "Lobby" && !room.definition.introVideo.url) {
      Actions.Intro(room);
    } else if (allReady && room.gameState.state === "Intro") {
      Actions.Intro(room);
    }
  },

  // All gameState.state transitions MUST happen through here if the game
  // is to function properly with the timer. We could enforce this by having
  // some private / protected methods. TODO: protect these state changes.
  TransitionState(room: Room, newState: State) {
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
  functions.logger.log("quip engine, reducing", {msg: message, gameState: room.gameState});
  const gameState = room.gameState;
  if (message.type === "NewPlayer") {
    Actions.NewPlayer(room, message);
  } else if (message.type === "Intro" && gameState.state === "Lobby") {
    Actions.Intro(room);
  } else if (message.type === "Input" && gameState.state === "Input") {
    Actions.Input(room, message);
  } else if (message.type === gameState.state || message.type === "ReadyToContinue") {
    Actions[message.type](room, message);
  } else if (message.type === "OutOfTime") {
    Actions.OutOfTime(room, message);
  }
  return gameState
}

export const engine = {reducer, init};
