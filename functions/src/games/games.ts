import * as PG from "./promptGuessBase";

export type TimerOption = "off" | "slow" | "fast";
export type EngineName = PG.GameDefinition["engine"]; // | ...
export type GameDefinition = PG.GameDefinition; // | ...
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

type GameEngine = PromptGuessEngine; // | AnotherEngine
export const engines:Record<EngineName, GameEngine> = {
  "PromptGuess": PG.engine,
}

// TODO: this doesn't seem quite right as far as managing types...
export type MessageTypes = {
  "PromptGuess": PG.PromptGuessMessage,
}
