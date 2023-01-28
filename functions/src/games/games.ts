import { PromptGuessRoom, PromptGuessMessage } from "./promptGuessBase";
import { Farsketched, Gisticle } from "./promptGuessers";

type GameName = "farsketched" | "gisticle"; // | "dixit" | "codenames" | ...
type Reducer<Room extends {gameState: any}, Message> = (gs: Room, m: Message) => Room["gameState"];
type PromptGuessEngine = { 
  reducer: Reducer<PromptGuessRoom, PromptGuessMessage>, 
  init: (uid: string) => PromptGuessRoom
}

type GameEngine = PromptGuessEngine; // | AnotherEngine
const engines:Record<GameName, GameEngine> = {
  "farsketched": Farsketched,
  "gisticle": Gisticle,
}

type MessageTypes = {
  "farsketched": PromptGuessMessage,
  "gisticle": PromptGuessMessage,
}


export { engines, GameName, MessageTypes }
