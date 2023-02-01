import { PromptGuessRoom, PromptGuesser, initState, UserID } from "./promptGuessBase";
import { chooseOne } from "../utils";

export const Farsketched = {
  reducer: PromptGuesser,
  init: (uid: UserID): PromptGuessRoom => {
    const t = {template: "{1}", display: "What would you like to see?"};
    return {
      ...initState(),
      gameName: "farsketched",
      introVideoUrl: "https://www.youtube.com/embed/3Cn3A8ad4x8",
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
  init: (uid: string): PromptGuessRoom => {
    const templates = [
      {template: "List the top 5 best {1}, don't explain why", display: "List the top 5 best..."},
      {template: "List the top 5 most ridiculous ways to {1}, don't explain why", display: "List the top 5 most ridiculous ways to..."},
      {template: "List the top 5 most obvious signs {1}, don't explain why", display: "List the top 5 most obvious signs..."},
      {template: "List the top 5 reasons you should {1}, don't explain why", display: "List the top 5 reasons you should..."},
    ];
    return {
      ...initState(),
      gameName: "gisticle",
      model: "GPT3",
      templates: templates,
      players: {
        [uid]: {state: "Lobby", template: chooseOne(templates)}
      }
    }
  }
}

export const Tresmojis = {
  reducer: PromptGuesser,
  init: (uid: string): PromptGuessRoom => {
    const templates = [
      {template: "List 3 emojis to describe {1} (don't explain why)\n\n", display: "[Memory] List 3 emojis to describe..."},
      {template: "List 3 emojis to describe {1} (don't explain why)\n\n", display: "[Abstract Noun] List 3 emojis to describe..."},
      {template: "List 3 emojis to describe {1} (don't explain why)\n\n", display: "[Person's Name] List 3 emojis to describe..."},
      {template: "List 3 emojis to describe {1} (don't explain why)\n\n", display: "[Adjective] List 3 emojis to describe..."},
      {template: "List 3 emojis to describe {1} (don't explain why)\n\n", display: "[Anything!] List 3 emojis to describe..."},
    ];
    return {
      ...initState(),
      gameName: "tresmojis",
      model: "GPT3",
      templates: templates,
      players: {
        [uid]: {state: "Lobby", template: chooseOne(templates)}
      }
    }
  }
}
