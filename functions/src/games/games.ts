import * as PG from "./promptGuessBase";
import * as Judge from "./aiJudge"

export type TimerOption = "off" | "slow" | "fast";
export type EngineName = PG.GameDefinition["engine"] | Judge.GameDefinition["engine"]; // | ...
export type GameDefinition = PG.GameDefinition | Judge.GameDefinition; // | ...
export type GameCreateData = {
  _creator: string,
  isPlayer: boolean,
  timer: TimerOption,
}

type Reducer<Room extends {gameState: any}, Message> = (gs: Room, m: Message) => Room["gameState"];

type Engine<GameDef, Room extends {gameState: any}, Message> = {
  reducer: Reducer<Room, Message>, 
  init: (v: GameCreateData, d: GameDef) => Room
}
type PromptGuessEngine = Engine<PG.GameDefinition, PG.PromptGuessRoom, PG.PromptGuessMessage>
type JudgeEngine = Engine<Judge.GameDefinition, Judge.Room, Judge.Message>

type GameEngine = PromptGuessEngine | JudgeEngine; // | AnotherEngine
export const engines:Record<EngineName, GameEngine> = {
  "PromptGuess": PG.engine,
  "AIJudge": Judge.engine,
}

// TODO: this doesn't seem quite right as far as managing types...
export type MessageTypes = {
  "PromptGuess": PG.PromptGuessMessage,
  "AIJudge": Judge.Message,
}
