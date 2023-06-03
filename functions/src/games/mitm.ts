import * as functions from "firebase-functions";
import { ROOM_FINISHED_STATE, ROOM_FINISHED_STATE_TYPE, arrayFromKeyedObject } from "../utils";
import { GENERATION_FULFILLED_MSG, GENERATION_FULFILLED_MSG_TYPE } from "../index";
import { ChatGPTDef, GenerationResponse, GenerationRequest } from "../generate";
import { GameCreateData } from "./games";

export type GameDefinition = {
  engine: "MITM",
  name: string,
  description: string,
  model: ChatGPTDef,
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
    model: ChatGPTDef,
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
      stepsBeforeMITM: 3//10 + Math.floor(Math.random() * 40)
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
    // const chatMessages = arrayFromKeyedObject(chat).map((m, i) => {
    //   return {role: message.uid === m.author ? "user" : "assistant", content: m.message};
    // })
    // const messages = [
    //   {role: "system", content: "You are having a chat conversation."},
    //   ...chatMessages
    // ];
    const dialogue = arrayFromKeyedObject(chat).reduce((prev, curr, i) => {
      return `${prev}\n${i % 2 === 0 ? "1" : "2"}: ${curr.message}`;
    }, "");
    const messages = [
      {role: "system", content: "You are a helpful assistant."},
      {role: "user", content: `Two people are having a dialogue.\n\n${dialogue}\n\nWrite the next line of dialogue to be in a consistent tone with the speaker. First, explain the tone, and then output their line of dialogue. Format the response like so [[your response here]].`},
    ];

    // Turn chat into an array of alternating user/assistant messages
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
    // Check if we're in MITM or Chat
    room.gameState.whoCalledRobot = message.uid;
    Actions.TransitionState(room, ROOM_FINISHED_STATE);
  },

  ProcessGeneration(room: Room, message: Message) {
    if (room.gameState.generations && room.gameState.generations[message.uid]) {
      const chat = (message.uid === room.gameState.player1 ? room.gameState.chat1 : room.gameState.chat2) ?? {};
      // TODO: make a time estimate for when it should be revealed.
      // We could calculate average typing speed by length of messages per time?
      // const otherPlayer = message.uid === "player1" ? "player2" : "player1";
      // let timeTyping = 0;
      // let messageLength = 0;
      // Object.keys is apparently a string[], even though we're using timestamps ugh
      // Object.keys(chat).sort((a,b) => { return a - b < 0 ? -1 : 1 }).forEach((t, i) => {
      //   if (i > 0 && chat[parseInt(t)].author === otherPlayer) {
      //     timeTyping += 
      //   }
      // });
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
      const parsedResponse = parse(generatedValue);
      const now = Date.now();
      chat[now] = {message: parsedResponse, author: "robot"};
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
