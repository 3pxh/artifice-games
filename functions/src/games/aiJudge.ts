import * as functions from "firebase-functions";
import { chooseOne, chooseOneInObject, shuffle } from "../utils";
import { ModelDef, GenerationResponse, GenerationRequest } from "../generate";
import { GameCreateData } from "./games";

export type GameDefinition = {
  engine: "AIJudge", // Unnecessary, for clarity in reading only
  name: string,
  questionPreface: string,
  categories: {
    [k: string]: string
  },
  model: ModelDef, // TODO: ensure stopSequence: ")"
  introVideo: {
    url: string,
    durationSeconds: number,
  },
}
type UserID = string;
export type State = "Lobby" | "Intro" | "Answer" | "Question" | "Vote" | "Score" | "Finish";
const STATE_TRANSITIONS:Record<State, State> = {
  "Lobby": "Intro",
  "Intro": "Answer",
  "Answer": "Question",
  "Question": "Vote",
  "Vote": "Score",
  "Score": "Vote",
  "Finish": "Finish",
}
export type Generation = Omit<GenerationRequest, "room"> & 
  GenerationResponse & {
    model: ModelDef,
    uid: string,
    category: string,
    question: string,
    answers: {
      [k: UserID]: {letter: string, value: string},
    },
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
    maxRound: number,
    category: string,
    currentGeneration: UserID | null,
    answers?: { [k: UserID]: string },
    questions?: { [k: UserID]: string },
    votes?: { [k: UserID]: UserID },
    generations?: { [k: UserID]: Generation },
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
  history: { // Where we're going to store generations along with all context.
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
      "Answer": 30 * scale,
      "Question": 30 * scale,
      "Vote": 20 * scale,
      "Score": 30 * scale,
      "Finish": Number.MAX_VALUE
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
      round: 0,
      category: chooseOneInObject(def.categories),
      maxRound: 3,
      currentGeneration: null,
      generations: {}, 
      answers: {},
      questions: {},
      scores: {},
    },
    players: {
      [roomOpts._creator]: {
        state: "Lobby", 
        isPlayer: roomOpts.isPlayer,
        isReadyToContinue: false,
      }
    },
    history: {},
  }
}
type MessageType = "Intro" | "Answer" | "Question" | "Vote" | 
  "NewPlayer" | "OutOfTime" | "ReadyToContinue";
export type Message = {
  type: MessageType,
  uid: UserID,
  value: string,
  isPlayer?: boolean,
}
const LETTERS = "ABCDEFGHIJKLMNOP";


const Actions = {
  ActivePlayerCount(room: Room) {
    return Object.entries(room.players).filter(([k,p]) => p.isPlayer).length;
  },

  NewPlayer(room: Room, message: Message) {
    functions.logger.log("AIJudge:NewPlayer");
    room.players[message.uid] = {
      state: "Lobby",
      isReadyToContinue: false,
      isPlayer: message.isPlayer ?? true,
    }
  },

  Intro(room: Room) {
    functions.logger.log("AIJudge:Start");
    room.gameState.scores = {};
    Object.keys(room.players).forEach(k => {
      room.gameState.scores![k] = {
        current: 0,
        previous: 0
      }
    });
    Actions.TransitionState(room, "Answer");
  },

  Answer(room: Room, message: Message) {
    room.gameState.answers = room.gameState.answers ?? {};
    room.gameState.answers[message.uid] = message.value;
    if (Object.keys(room.gameState.answers).length === Actions.ActivePlayerCount(room)) {
      Actions.TransitionState(room, "Question");
    }
  },

  Question(room: Room, message: Message) {
    if (!room.gameState.answers) {
      throw new Error("Trying to submit question without any answers");
    }
    room.gameState.questions = room.gameState.questions ?? {};
    room.gameState.questions[message.uid] = message.value;
    room.gameState.generations = room.gameState.generations ?? {};
    // TODO: enforce max players. This breaks above 16 (LETTERS.length)
    // and is probably not playable >8 (idk how well GPT picks among so many).
    const options:string[] = [];
    const answers:Generation["answers"] = {};
    // For each q, shuffle answers in case there's bias in GPT for 
    // either A, B, C, etc.
    shuffle(Object.entries(room.gameState.answers)).forEach(([u, value], i) => {
      const letter = LETTERS.charAt(i);
      answers[u] = { letter, value };
      options.push(`${letter}) ${value}`);
    })
    const pref = room.definition.questionPreface;
    const cat = room.gameState.category;
    const q = message.value;
    const opts = options.join('\n');
    const prompt = `${pref}\n\nWhich ${cat} ${q}?\n${opts}\n\nAnswer:`;

    room.gameState.generations[message.uid] = {
      _context: {},
      uid: message.uid,
      category: room.gameState.category!,
      question: message.value,
      answers: answers,
      prompt: prompt,
      // TODO: generate() should not be parsing templates!!
      // That should happen in promptGuessBase
      template: {template: "{1}"},
      model: room.definition.model,
      generation: "",
      fulfilled: false,
    };
    if (Object.keys(room.gameState.questions).length === Actions.ActivePlayerCount(room)) {
      Actions.TransitionState(room, "Vote");
    }
  },

  Vote(room: Room, message: Message) {
    room.gameState.votes = room.gameState.votes ?? {};
    room.gameState.votes[message.uid] = message.value;
    if (Object.keys(room.gameState.votes).length === Actions.ActivePlayerCount(room)) {
      Actions.TransitionState(room, "Score");
    }
  },

  Score(room: Room) {
    const gameState = room.gameState;
    if (gameState.generations && gameState.currentGeneration && gameState.scores) {
      Object.keys(gameState.scores).forEach(scorePlayer => {
        gameState.scores![scorePlayer].previous = gameState.scores![scorePlayer].current;
      });
      const gen = gameState.generations[gameState.currentGeneration];
      const aiChoice = gen.generation.toUpperCase().trim().charAt(0);
      const pickedPlayer = Object.keys(gen.answers).find(u => gen.answers[u].letter === aiChoice);
      if (LETTERS.indexOf(aiChoice) && pickedPlayer) { // Hooray
        // You get points if the generation picked your option.
        gameState.scores[pickedPlayer].current += 1000;
        Object.entries(gameState.votes!).forEach(([u, v]) => {
          if (v === pickedPlayer) {
            // You get points for voting for the truth
            gameState.scores![u].current += 500;
          }
        })
        // If someone voted incorrectly, reward the question writer!
        // TODO: figure out a score which makes for good incentives.
        // const notAllRight = Object.entries(gameState.votes!).some(([_, v]) => v !== pickedPlayer);
        // if (notAllRight) {
        //   gameState.scores[gen.uid].current += 500;
        // }
      } else { // The AI didn't pick a letter :(
        // What do we do?
      }
    } else {
      // Shouldn't ever get here.
    }
  },

  ContinueAfterScoring(room: Room) {
    const gameState = room.gameState;
    if (gameState.currentGeneration && gameState.generations && gameState.questions) {
      room.history = room.history || {};
      room.history[new Date().getTime()] = {
        generation: gameState.generations[gameState.currentGeneration],
      };
      gameState.votes = {};
      delete gameState.generations[gameState.currentGeneration];
      const gens = Object.keys(gameState.generations);
      if (gens.length > 0) {
        Actions.TransitionState(room, "Vote");
      } else if (gens.length === 0 && room.gameState.round < room.gameState.maxRound) {
        room.gameState.round += 1;
        gameState.answers = {};
        gameState.questions = {};
        Actions.TransitionState(room, "Answer");
      } else if (gens.length === 0 && room.gameState.round === room.gameState.maxRound) {
        Actions.TransitionState(room, "Finish");
      }
    } else {
      // we shouldn't have gotten here...
    }
  },

  OutOfTime(room: Room, message: Message) {
    const t = room.gameState.timer;
    const now = new Date().getTime();
    if (t && t.duration + t.started < now) { // Actually out of time
      const state = room.gameState.state;
      const autoTransitions:State[] = ["Intro", "Answer", "Question"];
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
    if (Object.entries(room.players).every(([k, p]) => p.isReadyToContinue) &&
        room.gameState.state === "Score") {
      Actions.ContinueAfterScoring(room);
    }
  },

  // All gameState.state transitions MUST happen through here if the game
  // is to function properly with the timer. We could enforce this by having
  // some private / protected methods. TODO: protect these state changes.
  TransitionState(room: Room, newState: State) {
    const outOfTimeAndNoOneSubmittedPrompts = !room.gameState.generations && newState === "Score";
    if (!outOfTimeAndNoOneSubmittedPrompts) {
      if (newState === "Answer") {
        room.gameState.category = chooseOneInObject(room.definition.categories);
      } else if (newState === "Vote" && room.gameState.generations) {
        // We should filter out errored generations. But when?
        const gens = Object.keys(room.gameState.generations);
        room.gameState.currentGeneration = chooseOne(gens);
      } else if (newState === "Score" && room.gameState.generations) {
        Actions.Score(room);
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

function reducer(room: Room, message: Message): any {
  functions.logger.log("aiJudge, reducing", {msg: message, gameState: room.gameState});
  const gameState = room.gameState;
  if (message.type === "NewPlayer" && gameState.state === "Lobby") {
    // Alternatively if the room allows spectators
    Actions.NewPlayer(room, message);
  } else if (message.type === "Intro" && gameState.state === "Lobby") {
    Actions.Intro(room);
  } else if (message.type === gameState.state || message.type === "ReadyToContinue") {
    Actions[message.type](room, message);
  } else if (message.type === "OutOfTime") {
    Actions.OutOfTime(room, message);
  }
  return gameState
}

export const engine = {reducer, init};
