import * as PG from "./promptGuessBase";
import * as Judge from "./aiJudge";
import * as Quip from "./quip";
import * as MITM from "./mitm"

export type TimerOption = "off" | "slow" | "fast";
export type EngineName = PG.GameDefinition["engine"] | Judge.GameDefinition["engine"] | Quip.GameDefinition["engine"] | MITM.GameDefinition["engine"]; // | ...
type GameTier = "Free" | "Underwriter"
export type GameDefBase = {tier: GameTier, hidden: boolean, emoji: string, color: string, about: string, shortAbout: string}
export type GameDefinition = GameDefBase & (PG.GameDefinition | Judge.GameDefinition | Quip.GameDefinition | MITM.GameDefinition); // | ...
export type GameCreateData = {
  _creator: string,
  _isAsync: boolean,
  isPlayer: boolean,
  timer: TimerOption,
}

export type Scores = {[uid: string]: {current: number, previous: number}}
type Reducer<Room extends {gameState: any}, Message> = (gs: Room, m: Message) => Room["gameState"];

type Engine<GameDef, Room extends {gameState: any}, Message> = {
  reducer: Reducer<Room, Message>, 
  init: (v: GameCreateData, d: GameDef) => Room
}
type PromptGuessEngine = Engine<PG.GameDefinition, PG.PromptGuessRoom, PG.PromptGuessMessage>
type JudgeEngine = Engine<Judge.GameDefinition, Judge.Room, Judge.Message>
type QuipEngine = Engine<Quip.GameDefinition, Quip.Room, Quip.Message>
type MITMEngine = Engine<MITM.GameDefinition, MITM.Room, MITM.Message>

type GameEngine = PromptGuessEngine | JudgeEngine | QuipEngine | MITMEngine; // | AnotherEngine
export const engines:Record<EngineName, GameEngine> = {
  "PromptGuess": PG.engine,
  "AIJudge": Judge.engine,
  "Quip": Quip.engine,
  "MITM": MITM.engine,
}
