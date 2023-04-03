import * as functions from "firebase-functions";
import { ROOM_FINISHED_STATE, ROOM_FINISHED_STATE_TYPE, chooseOneInObject, arrayFromKeyedObject, objectFilter, chooseOneKeyInObject } from "../utils";
import { ChatGPTDef, GenerationResponse, GenerationRequest } from "../generate";
import { GameCreateData } from "./games";

type ChatGPTMessage = {role: string, content: string};
type ChatGPTPrompt = {[i: string]: ChatGPTMessage};
export type QuipResponse = {points: number, comment: string};
export type GameDefinition = {
  engine: "Quip",
  name: string,
  description: string,
  model: ChatGPTDef,
  introVideo: {
    url: string,
    durationSeconds: number,
  },
  promptPreface: ChatGPTPrompt,
  roundPrompts: {
    [k: number]: string
  }
}
type UserID = string;
export type State = "Lobby" | "Intro" | "Input" | "Response" | "Score" | ROOM_FINISHED_STATE_TYPE;
const STATE_TRANSITIONS:Record<State, State> = {
  "Lobby": "Intro",
  "Intro": "Input",
  "Input": "Response",
  "Response": "Score",
  "Score": "Input",
  [ROOM_FINISHED_STATE]: ROOM_FINISHED_STATE,
}
export type Generation = Omit<GenerationRequest, "room" | "template" | "prompt"> & 
  GenerationResponse<QuipResponse> & {
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
    promptPreface: ChatGPTPrompt,
    roundPrompt: string,
    maxRound: number,
    currentPlayer: UserID,
    donePlayers: { [k: UserID]: boolean },
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
  scratchpad: { // Designed for realtime sync, all players can write to it.
    input: string,
  },
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
      "Response": 10 * scale,
      "Score": 10 * scale,
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
      currentPlayer: roomOpts._creator,
      donePlayers: {},
      roundPrompt: chooseOneInObject(def.roundPrompts),
      promptPreface: def.promptPreface,
      round: 1,
      maxRound: 3,
    },
    players: {
      [roomOpts._creator]: {
        state: "Lobby", 
        isPlayer: roomOpts.isPlayer,
        isReadyToContinue: false,
      }
    },
    scratchpad: {
      input: "",
    },
  }
}
type MessageType = "Intro" | "Input" | "NewPlayer" | "OutOfTime" | "ReadyToContinue";
export type Message = {
  type: MessageType,
  uid: UserID,
  value: string,
  isPlayer?: boolean,
}
export type GenerationSchema = {
  points: string,
  comment: string
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
    room.gameState.currentPlayer = chooseOneKeyInObject(objectFilter(room.players, p => p.isPlayer));
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
    Actions.generate(room);
    Actions.TransitionState(room, "Response");
  },

  generate(room: Room) {
    const gs = room.gameState;
    if (gs.quips) {
      gs.generations = {};
      const prompt = gs.quips[gs.currentPlayer];
      const handle = room.players[gs.currentPlayer].handle;
      const schema = '{"points": number, "comment": "string"}';
      const schemaFormat = {points: "number", comment: "string"};
      const formatPrompt = `\n\nGive output in the form ${schema}, return valid JSON. Begin your output with "{"`
      gs.generations["_engine"] = {
        _context: {},
        uid: "_engine",
        chatGPTParams: {
          messages: [
            ...arrayFromKeyedObject(gs.promptPreface),
            {role: "user", content: `Question: ${gs.roundPrompt}\n\nResponse from ${handle}: ${prompt}\n\n${formatPrompt}`},
          ],
          schema: schemaFormat
        },
        model: room.definition.model,
        generation: {points: 0, comment: ""},
        fulfilled: false,
      } as Generation;
    }
  },

  Score(room: Room) {
    const gs = room.gameState;
    if (gs.generations && gs.quips && gs.scores) {
      const g = gs.generations["_engine"].generation as QuipResponse;
      gs.scores[gs.currentPlayer].current += g.points;
      room.history = room.history ?? {};
      room.history[Date.now()] = {
        generation: gs.generations["_engine"],
      };
    }
  },

  ContinueAfterScoring(room: Room) {
    const gs = room.gameState;
    gs.donePlayers = gs.donePlayers ?? {};
    gs.donePlayers[gs.currentPlayer] = true;
    gs.generations = {};
    room.scratchpad = {input: ""};
    if (Object.keys(gs.donePlayers).length < Actions.activePlayerCount(room)) {
      const nextPlayer = chooseOneKeyInObject(objectFilter(room.players, (p, uid) => p.isPlayer && !gs.donePlayers[uid]));
      gs.currentPlayer = nextPlayer;
      Actions.TransitionState(room, "Input");
    } else {
      gs.roundPrompt = chooseOneInObject(room.definition.roundPrompts);
      if (gs.round < gs.maxRound) {
        gs.round += 1;
        gs.quips = {};
        gs.donePlayers = {};
        gs.currentPlayer = chooseOneKeyInObject(objectFilter(room.players, p => p.isPlayer));
        Actions.TransitionState(room, "Input");
      } else {
        Actions.TransitionState(room, ROOM_FINISHED_STATE);
      }
    }
  },

  OutOfTime(room: Room, message: Message) {
    // We can simply progress to the next player or state.
    const t = room.gameState.timer;
    const now = new Date().getTime();
    if (t && t.duration + t.started < now) { // Actually out of time
      const state = room.gameState.state;
      const autoTransitions:State[] = ["Intro", "Input", "Response"];
      if (autoTransitions.includes(state)) {
        Actions.TransitionState(room, room.stateTransitions[room.gameState.state]);
      } else if (state === "Score") {
        Actions.ContinueAfterScoring(room);
      }
    }
  },

  ReadyToContinue(room: Room, message: Message) {
    room.players[message.uid].isReadyToContinue = true;
    // If everyone is ready, we want to transition.
    const allReady = Object.entries(room.players).every(([_, p]) => p.isReadyToContinue || !p.isPlayer);
    if (allReady && room.gameState.state === "Response") {
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
