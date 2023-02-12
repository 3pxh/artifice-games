import { GameDefinition } from "./promptGuessBase"
// Note: this is technically dead code. It exists here only for typechecking.
export const FeaturedPGGames: {games: {[k: string]: GameDefinition}} = 
// These need to be added to emulator_data/database_export/{*}.json
// for it to load when running the emulators, and to
// the production DB for them to appear in prod.
{"games": {
  "farsketched_base": {
    "engine": "PromptGuess",
    "name": "Farsketched",
    "model": {"name": "StableDiffusion"},
    "templates": {
      "0": {"display": "Make an image of...", "template": "{1}"}
    },
    "introVideo": {
      "url": "https://www.youtube.com/embed/3Cn3A8ad4x8",
      "durationSeconds": 128
    }
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
      "url": "",
      "durationSeconds": 0
    }
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
      "url": "",
      "durationSeconds": 0
    }
  }
}}