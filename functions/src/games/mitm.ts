import * as functions from "firebase-functions";
import { ROOM_FINISHED_STATE, ROOM_FINISHED_STATE_TYPE, arrayFromKeyedObject } from "../utils";
import { GENERATION_FULFILLED_MSG, GENERATION_FULFILLED_MSG_TYPE } from "../index";
import { GPT4oDef, GenerationResponse, GenerationRequest } from "../generate";
import { GameCreateData } from "./games";

export type GameDefinition = {
  engine: "MITM",
  name: string,
  description: string,
  model: GPT4oDef,
  introVideo: {
    url: string,
    durationSeconds: number,
  },
}
type UserID = string;
export type State = "Lobby" | "Chat" | "MITM" | ROOM_FINISHED_STATE_TYPE;
const STATE_TRANSITIONS:Record<State, State> = {
  "Lobby": "Chat",
  "Chat": "MITM",
  "MITM": ROOM_FINISHED_STATE,
  [ROOM_FINISHED_STATE]: ROOM_FINISHED_STATE,
}

export type Timer = {
  started: number,
  duration: number,
  stateDurations: Record<State, number>,
}
type ChatMessage = {message: string, author: UserID | "robot"};
export type Generation = Omit<GenerationRequest, "room" | "template" | "prompt"> & 
  GenerationResponse<string> & {
    model: GPT4oDef,
    uid: string,
    fulfilled: boolean,
    error?: string,
  }
export type Room = {
  definition: GameDefinition,
  stateTransitions: Record<State, State>,
  gameState: {
    timer?: Timer,
    state: State,
    player1: UserID,
    player2?: UserID,
    chat1?: { [timestamp: number]: ChatMessage },
    chat2?: { [timestamp: number]: ChatMessage },
    whoCalledRobot?: UserID,
    stepsBeforeMITM: number,
    currentStep: number,
    generations?: { [k: UserID]: Generation | undefined },
  },
  players: { // Because we need to be able to set individual player data!
    [uid: UserID]: {
      state: State,
      handle?: string,
    }
  }
}

const init = (roomOpts: GameCreateData, def: GameDefinition): Room => {
  return {
    definition: def,
    stateTransitions: STATE_TRANSITIONS,
    gameState: {
      state: "Lobby",
      player1: roomOpts._creator,
      currentStep: 0,
      stepsBeforeMITM: 10 + Math.floor(Math.random() * 30)
    },
    players: {
      [roomOpts._creator]: {state: "Lobby", handle: "Player 1"}
    },
  }
}
type MessageType = "NewPlayer" | "Start" | "ChatMessage" | "ICallRobot" | GENERATION_FULFILLED_MSG_TYPE;
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

const Actions = {
  NewPlayer(room: Room, message: Message) {
    functions.logger.log("MITM:NewPlayer");
    room.players[message.uid] = {state: "Lobby"};
    room.gameState.player2 = room.gameState.player2 ?? message.uid;
  },

  Start(room: Room) {
    Actions.TransitionState(room, "Chat");
  },

  ChatDirect(room: Room, message: Message) {
    if (room.gameState.state !== "Chat") {
      return;
    }
    const lastMessage = arrayFromKeyedObject(room.gameState.chat1 ?? {}).pop();
    if (message.value === "" || message.uid === lastMessage?.author) {
      // They could send two messages quickly / hit the button twice
      return;
    }
    const now = Date.now();
    const msg = {message: message.value, author: message.uid};
    room.gameState.chat1 = room.gameState.chat1 ?? {};
    room.gameState.chat1[now] = msg;
    room.gameState.chat2 = room.gameState.chat2 ?? {};
    room.gameState.chat2[now] = msg;
    room.gameState.currentStep += 1;
    if (room.gameState.currentStep >= room.gameState.stepsBeforeMITM) {
      Actions.TransitionState(room, "MITM");
      Actions.ChatGenerated(room, message); // We need to generate for the last message!
    }
  },

  ChatGenerated(room: Room, message: Message) {
    const chat = (message.uid === room.gameState.player1 ? room.gameState.chat1 : room.gameState.chat2) ?? {};
    const now = Date.now();
    const msg = {message: message.value, author: message.uid};
    chat[now] = msg;
    const dialogue = arrayFromKeyedObject(chat).reduce((prev, curr, i) => {
      return `${prev}\n${i % 2 === 0 ? "1" : "2"}: ${curr.message}`;
    }, "");
    const aiSpeaker = message.uid === room.gameState.player1 ? "2" : "1";
    const messages = [
      {role: "system", content: "You are a helpful assistant."},
      {role: "user", content: `Below is the transcript for a dialogue between two speakers, numbered 1 and 2.\n\n${dialogue}\n\nContinue the transcript with a response for speaker ${aiSpeaker}. Make it sound like it came from speaker 1, and keep it under 20 words. Format it like so [[${aiSpeaker}: ...]].`},
    ];
    room.gameState.generations = room.gameState.generations ?? {};
    room.gameState.generations[message.uid] = {
      _context: {},
      uid: message.uid,
      chatGPTParams: {
        messages: messages,
      },
      model: room.definition.model,
      generation: "",
      fulfilled: false,
    } as Generation;
  },

  ICallRobot(room: Room, message: Message) {
    room.gameState.whoCalledRobot = message.uid;
    Actions.TransitionState(room, ROOM_FINISHED_STATE);
  },

  ProcessGeneration(room: Room, message: Message) {
    if (room.gameState.state === "MITM" && room.gameState.generations && room.gameState.generations[message.uid]) {
      const chat = (message.uid === room.gameState.player1 ? room.gameState.chat1 : room.gameState.chat2) ?? {};
      // Calculate the average typing speed      
      const chatArray = Object.entries(chat).sort((a,b) => { return parseInt(a[0]) - parseInt(b[0]) });
      const whichPlayer = chatArray.length % 2 === 0 ? 2 : 1;
      let totalWords = 0; let totalTime = 0;
      for (let i = whichPlayer; i < Math.min(chatArray.length, room.gameState.stepsBeforeMITM); i += 2) {
        totalTime += parseInt(chatArray[i][0]) - parseInt(chatArray[i - 1][0]);
        totalWords += chatArray[i][1].message.split(" ").length;
      }
      const rate = (.6 + .2 * Math.random()) * totalTime / totalWords;
      const generatedValue = room.gameState.generations[message.uid]?.generation ?? "";
      const parse = (input: string) => {
        const regex = /\[\[(.*?)\]\]/;  // Regular expression to match the string inside double square brackets
        const match = regex.exec(input);  // Find the match using the regex
        if (match && match.length > 1) {
          return match[1];
        } else {
          return `Failed to parse ${input}`;
        }
      }
      let parsedResponse = parse(generatedValue);
      const indicator = `${chatArray.length % 2 ? 2 : 1}:`
      parsedResponse = parsedResponse.indexOf(indicator) === 0 ? parsedResponse.slice(parsedResponse.indexOf(indicator) + 2) : parsedResponse;
      parsedResponse = parsedResponse.trim();
      const displayTime = Math.floor(parseInt(chatArray[chatArray.length - 1][0]) + rate * parsedResponse.split(" ").length);
      chat[displayTime] = {message: parsedResponse, author: "robot"};
      delete room.gameState.generations[message.uid];
    }
  },

  TransitionState(room: Room, newState: State) {
    room.gameState.state = newState;
  }
}

function reducer(room: Room, message: Message): any {
  functions.logger.log("mitm engine, reducing", {msg: message, gameState: room.gameState});
  const gameState = room.gameState;
  if (message.type === "NewPlayer") {
    Actions.NewPlayer(room, message);
  } else if (message.type === "Start" && gameState.state === "Lobby") {
    Actions.Start(room);
  } else if (message.type === "ChatMessage" && gameState.state === "Chat") {
    Actions.ChatDirect(room, message);
  } else if (message.type === "ChatMessage" && gameState.state === "MITM") {
    Actions.ChatGenerated(room, message);
  } else if (message.type === "ICallRobot") {
    Actions.ICallRobot(room, message);
  } else if (message.type === GENERATION_FULFILLED_MSG) {
    Actions.ProcessGeneration(room, message);
  }
  return gameState
}

export const engine = {reducer, init};
