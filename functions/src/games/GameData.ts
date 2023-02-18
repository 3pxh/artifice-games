import * as PG from "./promptGuessBase";
import * as Judge from "./aiJudge";

// TODO: we could initialize these into the db at startup and on deploy
// to make them a real source of truth.

// Note: this is technically dead code. It exists here only for typechecking.
export const FeaturedPGGames: {games: {[k: string]: PG.GameDefinition}} = 
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
      "durationSeconds": 128
    }
  },
  "farsketched_1_5": {
    "engine": "PromptGuess",
    "name": "FS🍯🦡",
    "model": {
      "name": "StableDiffusion",
      "version": "1.5"
    },
    "templates": {
      "0": {"display": "Make an image of...", "template": "{1}"}
    },
    "introVideo": {
      "url": "https://www.youtube.com/embed/3Cn3A8ad4x8",
      "durationSeconds": 128
    }
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
      "url": "",
      "durationSeconds": 0
    }
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

export const FeaturedJudgeGames: {games: {[k: string]: Judge.GameDefinition}} =
{"games": {
  "judge_best_answer": {
    "engine": "AIJudge",
    "name": "🧪🤖✅ AI Quiz",
    "questionPreface": "Select the best answer to the question.\n\nWhich one",
    "model": {
      "name": "GPT3",
      "stopSequences": {"0": ")"},
      "maxTokens": 10,
      "temperature": 0.2
    },
    "introVideo": {
      "url": "",
      "durationSeconds": 0
    }
  },
}}
