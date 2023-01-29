import { PromptGuessRoom, PromptGuessMessage } from "./promptGuessBase";
import { Farsketched, Gisticle, Tresmojis } from "./promptGuessers";

type GameName = "farsketched" | "gisticle" | "tresmojis"; // | "dixit" | "codenames" | ...
type Reducer<Room extends {gameState: any}, Message> = (gs: Room, m: Message) => Room["gameState"];
type PromptGuessEngine = { 
  reducer: Reducer<PromptGuessRoom, PromptGuessMessage>, 
  init: (uid: string) => PromptGuessRoom
}

type GameEngine = PromptGuessEngine; // | AnotherEngine
const engines:Record<GameName, GameEngine> = {
  "farsketched": Farsketched,
  "gisticle": Gisticle,
  "tresmojis": Tresmojis,
}

// TODO: this doesn't seem quite right as far as managing types...
type MessageTypes = {
  "farsketched": PromptGuessMessage,
  "gisticle": PromptGuessMessage,
  "tresmojis": PromptGuessMessage,
}

export { engines, GameName, MessageTypes }
