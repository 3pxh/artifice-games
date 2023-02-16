import * as functions from "firebase-functions";
import { chooseOne, shuffle, JudgeUtils } from "../utils";
import { ModelDef, GenerationResponse, GenerationRequest } from "../generate";
import { GameCreateData } from "./games";

export type GameDefinition = {
  engine: "AIJudge",
  name: string,
  questionPreface: string,
  model: ModelDef,
  introVideo: {
    url: string,
    durationSeconds: number,
  },
}
type UserID = string;
export type State = "Lobby" | "Intro" | "Answer" | "Question" | "Vote" | "Score" | "Finish";
const STATE_TRANSITIONS:Record<State, State> = {
  "Lobby": "Intro",
  "Intro": "Question",
  "Question": "Answer",
  "Answer": "Vote",
  "Vote": "Score",
  "Score": "Vote",
  "Finish": "Finish",
}
export type Generation = Omit<GenerationRequest, "room"> & 
  GenerationResponse & {
    model: ModelDef,
    uid: string,
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
    currentQuestion: UserID | null,
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
      round: 1,
      maxRound: 3,
      currentQuestion: null,
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

const Actions = {
  activePlayerCount(room: Room) {
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
    Actions.TransitionState(room, "Question");
  },

  Question(room: Room, message: Message) {
    room.gameState.questions = room.gameState.questions ?? {};
    room.gameState.questions[message.uid] = message.value;
    if (Object.keys(room.gameState.questions).length === Actions.activePlayerCount(room)) {
      Actions.TransitionState(room, "Answer");
    }
  },

  generate(room: Room) {
    const gs = room.gameState;
    if (gs.answers && gs.questions && gs.currentQuestion) {
      // TODO: enforce max players. This breaks above 16 (LETTERS.length)
      // and is probably not playable >8 (idk how well GPT picks among so many).
      const options:string[] = [];
      const answers:Generation["answers"] = {};
      // For each q, shuffle answers in case there's bias in GPT for 
      // either A, B, C, etc.
      shuffle(Object.entries(gs.answers)).forEach(([u, value], i) => {
        const letter = JudgeUtils.LETTERS.charAt(i);
        answers[u] = { letter, value };
        options.push(`${letter}) ${value}`);
      })
      const pref = room.definition.questionPreface;
      const q = gs.questions[gs.currentQuestion];
      const opts = options.join('\n');
      const prompt = `${pref}${q}?\n${opts}\n\nAnswer:`;

      gs.generations = { // This is only plural because of how generationRequest watches the db 
        [gs.currentQuestion]: {
          _context: {},
          uid: gs.currentQuestion,
          question: q,
          answers: answers,
          prompt: prompt,
          // TODO: generate() should not be parsing templates!!
          // That should happen in promptGuessBase
          template: {template: "{1}"},
          model: room.definition.model,
          generation: "",
          fulfilled: false,
        }
      };
    }
  },

  Answer(room: Room, message: Message) {
    room.gameState.answers = room.gameState.answers ?? {};
    room.gameState.answers[message.uid] = message.value;
    if (Object.keys(room.gameState.answers).length === Actions.activePlayerCount(room)) {
      Actions.generate(room);
      // The first few seconds of Vote we'll be waiting on the generation
      Actions.TransitionState(room, "Vote");
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
    if (gameState.generations && gameState.scores) {
      Object.keys(gameState.scores).forEach(scorePlayer => {
        gameState.scores![scorePlayer].previous = gameState.scores![scorePlayer].current;
      });
      const gen = gameState.generations[Object.keys(gameState.generations)[0]];
      const pickedPlayer = JudgeUtils.choiceUid(gen);
      if (pickedPlayer) { // Hooray
        // You get points if the generation picked your option.
        gameState.scores[pickedPlayer].current += JudgeUtils.pointValues.authorOfTruth;
        Object.entries(gameState.votes!).forEach(([u, v]) => {
          if (v === pickedPlayer) {
            // You get points for voting for the truth
            gameState.scores![u].current += JudgeUtils.pointValues.votedTruth;
            gameState.scores![v].current += JudgeUtils.pointValues.authorOfTruthVote;
          } else {
            gameState.scores![v].current += JudgeUtils.pointValues.authorOfLieVote;
          }
        });
      } else { // The AI didn't pick a letter :(
        // What do we do?
      }
    } else {
      // Shouldn't ever get here.
    }
  },

  ContinueAfterScoring(room: Room) {
    const gameState = room.gameState;
    if (gameState.generations && gameState.questions && gameState.currentQuestion) {
      room.history = room.history || {};
      room.history[new Date().getTime()] = {
        generation: gameState.generations[Object.keys(gameState.generations)[0]],
      };
      gameState.votes = {};
      gameState.generations = {};
      delete gameState.questions[gameState.currentQuestion]
      const qs = Object.keys(gameState.questions);
      gameState.answers = {};
      if (qs.length > 0) {
        Actions.TransitionState(room, "Answer");
      } else if (qs.length === 0 && room.gameState.round < room.gameState.maxRound) {
        room.gameState.round += 1;
        gameState.questions = {};
        Actions.TransitionState(room, "Question");
      } else if (qs.length === 0 && room.gameState.round === room.gameState.maxRound) {
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
    if (newState === "Answer" && room.gameState.questions) {
      room.gameState.currentQuestion = chooseOne(Object.keys(room.gameState.questions));
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
