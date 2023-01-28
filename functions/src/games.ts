
export function PromptGuesser(room: any, message: any): any {
  const gameState = room.gameState;
  gameState["powerlevel"] = 9000;
  // TODO: handle the message, return a new game state.
  return gameState
}

export function AnotherEngine(room: any, message: any): any {
  const gameState = room.gameState;
  gameState["answer"] = 42;
  // TODO: handle the message, return a new game state.
  return gameState
}
