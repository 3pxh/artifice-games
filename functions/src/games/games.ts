import { PromptGuesser, PromptGuessMessage } from "./promptGuess";

function AnotherEngine(room: any, message: any): any {
  const gameState = room.gameState;
  gameState["answer"] = 42;
  // TODO: handle the message, return a new game state.
  return gameState
}

type GameName = "farsketched" | "gisticle"; // | "dixit" | "codenames" | ...
type GameEngine = typeof PromptGuesser | typeof AnotherEngine;
const engines:Record<GameName, GameEngine> = {
  "farsketched": PromptGuesser,
  "gisticle": AnotherEngine,
}

type MessageTypes = {
  "farsketched": PromptGuessMessage,
  "gisticle": PromptGuessMessage,
}


export { engines, GameName, MessageTypes }
