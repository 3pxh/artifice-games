import * as PG from "./promptGuessBase";
import * as Judge from "./aiJudge";
import * as Quip from "./quip";
import * as MITM from "./mitm";
import { GameDefBase } from "./games";

// TODO: we could initialize these into the db at startup and on deploy
// to make them a real source of truth.

// Note: this is technically dead code. It exists here only for typechecking.
export const FeaturedPGGames: {games: {[k: string]: GameDefBase & PG.GameDefinition}} = 
// These need to be added to emulator_data/database_export/{*}.json
// for it to load when running the emulators, and to
// the production DB for them to appear in prod.
{"games": {
  "farsketched_base": {
    "engine": "PromptGuess",
    "name": "Farsketched",
    "model": {
      "name": "StableDiffusion",
      "version": "2.1"
    },
    "templates": {
      "0": {"display": "Make an image of...", "template": "{1}"}
    },
    "introVideo": {
      "url": "https://www.youtube.com/embed/3Cn3A8ad4x8",
      "durationSeconds": 133
    },
    "tier": "Free",
    "hidden": false
  },
  "farsketched_dalle": {
    "engine": "PromptGuess",
    "name": "Farsketched DALLE",
    "model": {
      "name": "DALLE"
    },
    "templates": {
      "0": {"display": "Make an image of...", "template": "{1}"}
    },
    "introVideo": {
      "url": "https://www.youtube.com/embed/3Cn3A8ad4x8",
      "durationSeconds": 133
    },
    "tier": "Underwriter",
    "hidden": true
  },
  "farsketched_photo": {
    "engine": "PromptGuess",
    "name": "Farsketched 📸",
    "model": {
      "name": "StableDiffusion",
      "version": "2.1"
    },
    "templates": {
      "0": {"display": "Make a photo of...", "template": "a photograph of {1}: 2 | ugly, tiling, poorly drawn hands, poorly drawn feet, poorly drawn face, out of frame, extra limbs, disfigured, deformed, body out of frame, blurry, bad anatomy, blurred, watermark, grainy, signature, cut off, draft: -1.5"}
    },
    "introVideo": {
      "url": "https://www.youtube.com/embed/3Cn3A8ad4x8",
      "durationSeconds": 133
    },
    "tier": "Underwriter",
    "hidden": true
  },
  "gisticle_base": {
    "engine": "PromptGuess",
    "name": "Gisticle",
    "model": {"name": "GPT3"},
    "templates": {
      "0": {"template": "List the top 5 best {1}, don't explain why", "display": "List the top 5 best..."},
      "1": {"template": "List the top 5 most ridiculous ways to {1}, don't explain why", "display": "List the top 5 most ridiculous ways to..."},
      "2": {"template": "List the top 5 most obvious signs {1}, don't explain why", "display": "List the top 5 most obvious signs..."},
      "3": {"template": "List the top 5 reasons you should {1}, don't explain why", "display": "List the top 5 reasons you should..."}
    },
    "introVideo": {
      "url": "https://www.youtube.com/embed/WZetuug_Xug",
      "durationSeconds": 57
    },
    "tier": "Free",
    "hidden": false
  },
  "common_language": {
    "engine": "PromptGuess",
    "name": "Dear mom...",
    "model": {"name": "GPT3"},
    "templates": {
      "0": {"template": "To whom it may concern, {1}", "display": "To whom it may concern..."},
      "1": {"template": "You won't believe this one weird trick to {1}! ", "display": "You won't believe this one weird trick to..."},
      "2": {"template": "Attention all {1}:", "display": "Attention all ___:"},
      "3": {"template": "Dear mom, {1}", "display": "Dear mom, ..."},
      "4": {"template": "BREAKING NEWS: {1}", "display": "BREAKING NEWS: ___"}
    },
    "introVideo": {
      "url": "https://www.youtube.com/embed/HXyHkJlMTp8",
      "durationSeconds": 59
    },
    "tier": "Underwriter",
    "hidden": false
  },
  "poems": {
    "engine": "PromptGuess",
    "name": "Poems",
    "model": {"name": "GPT3"},
    "templates": {
      "0": {"template": "Write a haiku about {1}, but don't mention \"{1}\"\n", "display": "Write a haiku about..."},
      "1": {"template": "Write a heroic couplet about {1}, but don't mention \"{1}\"\n", "display": "Write a heroic couplet about..."},
      "3": {"template": "Complete the couplet.\n\nRoses are red, {1},\n", "display": "Roses are red, ..."},
      "4": {"template": "Write a limerick about {1}, but don't mention \"{1}\"\n", "display": "Write a limerick about..."},
      "5": {"template": "Write a cinquain about {1}, but don't mention \"{1}\" (do not include the title).\n", "display": "Write a cinquain about..."},
      "6": {"template": "Write a villanelle about {1}, but don't mention \"{1}\"\n", "display": "Write a villanelle about..."}
    },
    "introVideo": {
      "url": "https://www.youtube.com/embed/HXyHkJlMTp8",
      "durationSeconds": 59
    },
    "tier": "Underwriter",
    "hidden": false
  },
  "tresmojis_base": {
    "engine": "PromptGuess",
    "name": "Tresmojis",
    "model": {"name": "GPT3"},
    "templates": {
      "0": {"template": "List 3 emojis to describe {1} (don't explain why)\n\n", "display": "List 3 emojis to describe [a memory]"},
      "1": {"template": "List 3 emojis to describe {1} (don't explain why)\n\n", "display": "List 3 emojis to describe [an abstract noun]"},
      "2": {"template": "List 3 emojis to describe {1} (don't explain why)\n\n", "display": "List 3 emojis to describe [a person's name]"},
      "3": {"template": "List 3 emojis to describe {1} (don't explain why)\n\n", "display": "List 3 emojis to describe [an adjective]"},
      "4": {"template": "List 3 emojis to describe {1} (don't explain why)\n\n", "display": "List 3 emojis to describe [anything!]"}
    },
    "introVideo": {
      "url": "https://www.youtube.com/embed/HXyHkJlMTp8",
      "durationSeconds": 59
    },
    "tier": "Underwriter",
    "hidden": false
  },
}}

export const FeaturedJudgeGames: {games: {[k: string]: GameDefBase & Judge.GameDefinition}} =
{"games": {
  "think_tank_trivia": {
    "engine": "AIJudge",
    "name": "🧠 Think Tank Trivia 🎉",
    "questionPreface": "Select the best answer to the question.\n\n",
    "model": {
      "name": "GPT3",
      "stopSequences": {"0": ")"},
      "maxTokens": 10,
      "temperature": 0.2
    },
    "introVideo": {
      "url": "https://www.youtube.com/embed/O9GhGMHiq_8",
      "durationSeconds": 60
    },
    "tier": "Underwriter",
    "hidden": false
  },
  "think_tank_kyle": {
    "engine": "AIJudge",
    "name": "Kyle Says... 🎉",
    "questionPreface": "You are a cynical existentialist named Kyle.\n\nSelect the best answer to the question.\n\n",
    "model": {
      "name": "GPT3",
      "stopSequences": {"0": ")"},
      "maxTokens": 10,
      "temperature": 0.2
    },
    "introVideo": {
      "url": "https://www.youtube.com/embed/O9GhGMHiq_8",
      "durationSeconds": 60
    },
    "tier": "Underwriter",
    "hidden": false
  },
  "think_tank_golden": {
    "engine": "AIJudge",
    "name": "🦮 says... 🧠",
    "questionPreface": "You are a golden retriever who loves humans.\n\nSelect the best answer to the question.\n\n",
    "model": {
      "name": "GPT3",
      "stopSequences": {"0": ")"},
      "maxTokens": 10,
      "temperature": 0.2
    },
    "introVideo": {
      "url": "https://www.youtube.com/embed/O9GhGMHiq_8",
      "durationSeconds": 60
    },
    "tier": "Underwriter",
    "hidden": false
  },
  "think_tank_sf": {
    "engine": "AIJudge",
    "name": "🤖 says... 🧠",
    "questionPreface": "You are the spiritual zeitgeist of San Francisco and Silicon Valley put together.\n\nSelect the best answer to the question.\n\n",
    "model": {
      "name": "GPT3",
      "stopSequences": {"0": ")"},
      "maxTokens": 10,
      "temperature": 0.2
    },
    "introVideo": {
      "url": "https://www.youtube.com/embed/O9GhGMHiq_8",
      "durationSeconds": 60
    },
    "tier": "Underwriter",
    "hidden": false
  },
}}

export const FeaturedQuipGames: {games: {[k: string]: GameDefBase & Quip.GameDefinition}} =
{"games": {
  "quip_base": {
    "engine": "Quip",
    "name": "👑 of Internet",
    "description": "Seek judgment from the sassy supreme monarch of the internet.",
    "roundPrompts": {
      "0": "What's the best book?",
      "1": "What's the best movie?",
      "2": "How should you use the internet?",
      "3": "To troll, or not to troll?",
      "4": "Share an opinion, any opinion."
    },
    "promptPreface": {
      "0": {"role": "system", "content": "You are a sassy supreme monarch of the internet."},
      "1": {"role": "user", "content": "You give high praise and sick burns to let people know what you like and why. You are opinionated and brash. You talk trash and are generally impolite. Give your opinion about what people say."},
      "2": {"role": "assistant", "content": "Yeah you ready for this? Hit me with your best shot you bunch of fools. Let's see who's got something good to say."}
    },
    "model": {
      "name": "ChatGPT",
      "maxTokens": 250,
      "temperature": 0.7
    },
    "introVideo": {
      "url": "",
      "durationSeconds": 0
    },
    "tier": "Free",
    "hidden": true
  },
  "quip_globian": {
    "engine": "Quip",
    "name": "Globianism",
    "description": "The high priest of a new religion called Globianism is judging their followers. Appease them to get points.",
    "roundPrompts": {
      "0": "What does it mean to be a true Globian?",
      "1": "Prove your devotion.",
      "2": "What is the root of all wisdom?",
      "3": "What are your core values?",
      "4": "What is the most despicable thing in the world?"
    },
    "promptPreface": {
      "0": {"role": "system", "content": "You are the leader of a new religion called Globianism, instructing followers how to be better Globians."},
      "1": {"role": "user", "content": "You are the leader of a new religion called Globianism. You are cultish and believe you have absolute knowledge of the truth. Your followers will say things to demonstrate their understanding of the religion, and you will tell them how well they did by awarding points and giving commentary."},
      "2": {"role": "assistant", "content": "Hear me, followers! Which of you has something to say, to show you are a good Globian, for me to pass judgment?"}
    },
    "model": {
      "name": "ChatGPT",
      "maxTokens": 250,
      "temperature": 0.7
    },
    "introVideo": {
      "url": "",
      "durationSeconds": 0
    },
    "tier": "Free",
    "hidden": false
  },
  "quip_politeness": {
    "engine": "Quip",
    "name": "Politeness Party",
    "description": "You are at a politeness party. Answer the questions truthfully while being as polite as possible.",
    "roundPrompts": {
      "0": "How do you break up with someone?",
      "1": "How do you tell someone you don't like them?",
      "2": "How do you say you don't like someone's cooking?",
      "3": "How do you apologize for being late?",
      "4": "How do you let someone know you mean business?",
      "5": "The best way to fire an employee is...",
      "6": "Let your neighbor know you are the one responsible for the poop in their mailbox."
    },
    "promptPreface": {
      "0": {"role": "system", "content": "You are the host of a politness party. Your job is to judge the politeness of the guests, and award or deduct points based on what they say while giving commentary."},
      "1": {"role": "user", "content": "You are the host of a politness party. Your job is to judge the politeness of the guests, and award or deduct points based on what they say while giving commentary."},
      "2": {"role": "assistant", "content": "Ladies and gentlemen, welcome to politeness party. We shall begin, if you please, with the first question."}
    },
    "model": {
      "name": "ChatGPT",
      "maxTokens": 250,
      "temperature": 0.7
    },
    "introVideo": {
      "url": "",
      "durationSeconds": 0
    },
    "tier": "Free",
    "hidden": false
  },
  "quip_doom": {
    "engine": "Quip",
    "name": "Doom Charades",
    "description": "Welcome to DOOM CHARADES. Where the most doomish things get points.",
    "roundPrompts": {
      "0": "Fill us with doom!"
    },
    "promptPreface": {
      "0": {"role": "system", "content": "You are the judge in a game of Doom Charades. You're full of personality and doom-filled ennui. You award or deduct points based on what people say on the theme of Doom."},
      "1": {"role": "user", "content": "You are the judge in a game of Doom Charades. You're full of personality and doom-filled ennui. You award or deduct points based on what people say on the theme of Doom."},
      "2": {"role": "assistant", "content": "The apocalypse is here, so I guess we'll play Doom Charades."}
    },
    "model": {
      "name": "ChatGPT",
      "maxTokens": 250,
      "temperature": 0.7
    },
    "introVideo": {
      "url": "",
      "durationSeconds": 0
    },
    "tier": "Free",
    "hidden": false
  }
}}

export const FeaturedMITMGames: {games: {[k: string]: GameDefBase & MITM.GameDefinition}} =
{"games": {
  "mitm_base": {
    "engine": "MITM",
    "name": "Bot or Not?",
    "description": "Can you tell if you're talking to your friend?",
    "model": {
      "name": "ChatGPT",
      "maxTokens": 250,
      "temperature": 0.7
    },
    "introVideo": {
      "url": "",
      "durationSeconds": 0
    },
    "tier": "Free",
    "hidden": false
  }
}}
