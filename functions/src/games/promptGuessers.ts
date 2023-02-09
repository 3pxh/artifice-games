import { PromptGuessRoom, PromptGuesser, initState } from "./promptGuessBase";
import { chooseOne } from "../utils";
import { GameCreateData } from "./games";

const defaultPlayer:Omit<PromptGuessRoom["players"]["user"], "template" | "isPlayer"> = {state: "Lobby", isReadyToContinue: false};

const makeTimer = (timer: GameCreateData["timer"], videoDurS: number, gameScale = 1) => {
  if (timer !== "off") {
    const scale = (timer === "slow" ? 2000 : 1000) * gameScale;
    return { // This nesting is so we can spread it.
      started: 0,
      duration: 0,
      stateDurations: {
        "Lobby": Number.MAX_VALUE, // Needs all states for typing :/
        // TODO: refactor and make this easy to change out.
        "Intro": videoDurS * 1000, //Farsketched video is 128 seconds.
        "Prompt": 40 * scale,
        "Lie": 30 * scale,
        "Vote": 30 * scale,
        "Score": 30 * scale,
        "Finish": Number.MAX_VALUE
      },
    };
  } else {
    return undefined;
  }
}

// TODO: Define all of these as purely data. 
// https://app.asana.com/0/1203750744883349/1203924722663829
// And make a constructor that can load them in.
export const Farsketched = {
  reducer: PromptGuesser,
  init: (u: GameCreateData): PromptGuessRoom => {
    const t = {template: "{1}", display: "Make an image of..."};
    const baseState = initState();
    const timer = makeTimer(u.timer, 128);
    if (timer) { baseState.gameState.timer = timer; }
    return {
      ...baseState,
      gameName: "farsketched",
      introVideoUrl: "https://www.youtube.com/embed/3Cn3A8ad4x8",
      model: "StableDiffusion",
      templates: [t],
      players: {
        [u._creator]: {
          ...defaultPlayer,
          template: t,
          isPlayer: u.isPlayer
        }
      }
    }
  }
}

export const Gisticle = {
  reducer: PromptGuesser,
  init: (u: GameCreateData): PromptGuessRoom => {
    const templates = [
      {template: "List the top 5 best {1}, don't explain why", display: "List the top 5 best..."},
      {template: "List the top 5 most ridiculous ways to {1}, don't explain why", display: "List the top 5 most ridiculous ways to..."},
      {template: "List the top 5 most obvious signs {1}, don't explain why", display: "List the top 5 most obvious signs..."},
      {template: "List the top 5 reasons you should {1}, don't explain why", display: "List the top 5 reasons you should..."},
    ];
    const baseState = initState();
    const timer = makeTimer(u.timer, 1);
    if (timer) { baseState.gameState.timer = timer; }
    return {
      ...baseState,
      gameName: "gisticle",
      model: "GPT3",
      templates: templates,
      players: {
        [u._creator]: {
          ...defaultPlayer,
          template: chooseOne(templates),
          isPlayer: u.isPlayer,
        }
      }
    }
  }
}

export const Tresmojis = {
  reducer: PromptGuesser,
  init: (u: GameCreateData): PromptGuessRoom => {
    const templates = [
      {template: "List 3 emojis to describe {1} (don't explain why)\n\n", display: "[Memory] List 3 emojis to describe..."},
      {template: "List 3 emojis to describe {1} (don't explain why)\n\n", display: "[Abstract Noun] List 3 emojis to describe..."},
      {template: "List 3 emojis to describe {1} (don't explain why)\n\n", display: "[Person's Name] List 3 emojis to describe..."},
      {template: "List 3 emojis to describe {1} (don't explain why)\n\n", display: "[Adjective] List 3 emojis to describe..."},
      {template: "List 3 emojis to describe {1} (don't explain why)\n\n", display: "[Anything!] List 3 emojis to describe..."},
    ];
    const baseState = initState();
    const timer = makeTimer(u.timer, 1);
    if (timer) { baseState.gameState.timer = timer; }
    return {
      ...baseState,
      gameName: "tresmojis",
      model: "GPT3",
      templates: templates,
      players: {
        [u._creator]: {
          ...defaultPlayer,
          template: chooseOne(templates),
          isPlayer: u.isPlayer,
        }
      }
    }
  }
}
