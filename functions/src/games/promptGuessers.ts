import { PromptGuessRoom, PromptGuesser, initState, UserID } from "./promptGuessBase";

export const Farsketched = {
  reducer: PromptGuesser,
  init: (uid: UserID): PromptGuessRoom => {
    const t = {template: "$1", display: "Make a picture!"};
    return {
      ...initState(),
      gameName: "farsketched",
      model: "StableDiffusion",
      templates: [t],
      players: {
        [uid]: {state: "Lobby", template: t}
      }
    }
  }
}

export const Gisticle = {
  reducer: PromptGuesser,
  init: (): PromptGuessRoom => {
    return {
      ...initState(),
      gameName: "gisticle",
      model: "GPT3",
      templates: [
        {template: "List the top 5 best $1, don't explain why", display: "List the top 5 best..."},
        {template: "List the top 5 most ridiculous ways to $1, don't explain why", display: "List the top 5 most ridiculous ways to..."},
        {template: "List the top 5 most obvious signs $1, don't explain why", display: "List the top 5 most obvious signs..."},
        {template: "List the top 5 reasons you should $1, don't explain why", display: "List the top 5 reasons you should..."},
      ],
    }
  }
}
