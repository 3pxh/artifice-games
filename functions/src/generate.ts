import { logger } from "firebase-functions";
import axios, { AxiosError } from "axios";
import * as AWS from "aws-sdk";
import App from "./app";

export type Models =  "GPT3" | "StableDiffusion" | "DALLE" | "ChatGPT" | "GPT4"
export type GPT3Def = {
  name: "GPT3",
  stopSequences?: {
    [k: string]: string
  },
  maxTokens?: number,
  temperature?: number,
}
export type ChatGPTDef = {
  name: "ChatGPT",
  stopSequences?: {
    [k: string]: string
  },
  maxTokens?: number,
  temperature?: number,
}
export type GPT4Def = {
  name: "GPT4",
  stopSequences?: {
    [k: string]: string
  },
  maxTokens?: number,
  temperature?: number,
}
export type SDDef = {
  name: "StableDiffusion",
  version: "1.5" | "2.1",
}
export type DalleDef = {
  name: "DALLE",
}
export type ModelDef = GPT3Def | SDDef | DalleDef | ChatGPTDef | GPT4Def;
type Schema = {[key: string]: "string" | "number"};
type ParsedSchema = {[key: string]: string | number};
export type GenerationRequest = {
  room: string,
  uid: string,
  model: ModelDef,
  template: {template: string},
  prompt: string,
  chatGPTParams?: {
    messages: {role: string, content: string}[],
    schema: Schema,
  }
}

export type GenerationResponse = {
  _context?: any,
  generation: string | ParsedSchema,
  timeFulfilled?: number,
}

App.instance;
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY
});
const BUCKET_NAME = "artifice-1";

async function runStableDiffusion(r: GenerationRequest, tryCount = 0): GenerationPromise {
  logger.log("Running Stable Diffusion");
  if (!process.env.STABILITY_API_KEY) {
    throw new Error("Missing STABILITY_API_KEY");
  }
  
  const MAX_TRIES = 2;
  const model = r.model as SDDef;
  const modelPaths:Record<SDDef["version"], string> = {
    "1.5": "stable-diffusion-v1-5",
    "2.1": "stable-diffusion-512-v2-1"
  }
  const version = model.version ?? "2.1";
  const engineId = modelPaths[version];
  const apiHost = "https://api.stability.ai";
  const url = `${apiHost}/v1beta/generation/${engineId}/text-to-image`;

  const prompt = r.template.template.replace("{1}", r.prompt);
  const weightedPrompts = prompt.split("|").map(p => {
    if (p.indexOf(":")) {
      const weight = p.split(":").pop();
      if (weight && parseFloat(weight)) {
        // Do as I say, not as I do.
        return {
          "text": p.split(":").slice(0,-1).join(":").trim(),
          "weight": parseFloat(weight)
        };
      }
    }
    return {"text": p.trim(), "weight": 1};
  });

  let response;
  try {
    response = await axios({
      url: url,
      method: "POST",
      responseType: "stream",
      headers: {
        "Content-Type": "application/json",
        Accept: "image/png",
        Authorization: process.env.STABILITY_API_KEY,
      },
      data: JSON.stringify({
        cfg_scale: 7,
        clip_guidance_preset: "FAST_BLUE",
        height: 512,
        width: 512,
        samples: 1,
        // seed: 0,
        steps: 30,
        text_prompts: weightedPrompts,
      })
    });
  } catch (e) {
    const err = e as AxiosError<unknown, any>;
    if (err.status === 400) {
      // (note, this if() never returns true. Also, we don't know exactly why this failed:
      // https://api.stability.ai/docs#tag/v1alphageneration/operation/v1alpha/generation#textToImage
      // It's either invalid_samples, invalid_height_or_width, or invalid_prompts.
      // Since we control samples, and h/w, it's the prompt.
      // Axios unfortunately masks the name. It might be better to move to node-fetch. idk.
      throw new Error("Your prompt was not valid and may have contained filtered words.")
    }
    // TODO: the above is broken--err.status is apparently empty, but shows if you log it. wtf.
    throw new Error("Your prompt was not valid and may have contained filtered words.")
  }

  if (!response || !response.headers) {
    throw new Error("Request to Stable Diffusion failed");
  }

  if (tryCount < MAX_TRIES && response.headers["finish-reason"] !== "SUCCESS") {
    return runStableDiffusion(r, tryCount + 1);
  } else if (tryCount === MAX_TRIES && response.headers["finish-reason"] !== "SUCCESS") {
    if (response.headers["finish-reason"] === "CONTENT_FILTERED") {
      throw new Error(`Tried ${tryCount} times but the content was blurred, is your prompt NSFW?`)
    } else {
      throw new Error(`Tried ${tryCount} times but got an error response: ${JSON.stringify(response.data)}`)
    }
  }

  if (response.status !== 200) {
    throw new Error(`Response from stable diffusion not ok, response: ${JSON.stringify(response.data)}`)
  }
  const seed = response.headers["seed"];
  // Don't include the prompt in the filename or people can peek!
  const filename = `images/StableDiffusion/${r.room}/${seed}.png`;
  const params = {
    Bucket: BUCKET_NAME,
    Key: filename,
    Body: response.data
  };
  const res = await s3.upload(params).promise();
  return {
    _context: {
      seed: seed, 
      // TODO: include full model parameters?
    },
    generation: res.Location,
    timeFulfilled: new Date().getTime(),
  };
}

async function runDalle(r: GenerationRequest): GenerationPromise {
  if (!process.env.OPENAI_API_KEY) {
    throw new  Error("Missing OPENAI_API_KEY");
  }
  const prompt = r.template.template.replace(/\{1\}/g, r.prompt);
  const response = await axios({
    url: "https://api.openai.com/v1/images/generations",
    headers: {
      Authorization: "Bearer " + process.env.OPENAI_API_KEY, 
      "Content-Type": "application/json" 
    },
    method: "POST",
    data: JSON.stringify({
      "prompt": prompt,
      "n": 1,
      "size": "512x512",
    })
  });
  if (response.status !== 200) {
    throw new Error("Response from Dalle not ok");
  }
  const imgUrl = response.data.data[0].url;
  const response2 = await axios({
    url: imgUrl,
    method: "GET",
    responseType: "stream",
  });
  const filename = `images/Dalle/${r.room}/${Math.random()}.png`;
  const uploadParams = {
    Bucket: BUCKET_NAME,
    Key: filename,
    Body: response2.data
  };
  const res = await s3.upload(uploadParams).promise();
  return {
    _context: { },
    generation: res.Location,
    timeFulfilled: new Date().getTime(),
  }
}

function parseWithSchema(res: string, schema: Schema) {
  try {
    const parsed = JSON.parse(res);
    const isValid = Object.entries(schema).every(([n, t]) => {
      return parsed[n] && typeof(parsed[n]) === t;
    })
    if (isValid) {
      return parsed;
    } else {
      return null;
    }
  } catch(e) {
    return null;
  }
}

async function runChatCompletion(modelName: "ChatGPT" | "GPT4", r: GenerationRequest, retries=1): GenerationPromise {
  const MAX_RETRIES = 2;
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY");
  }
  if (!r.chatGPTParams) {
    throw new Error("Trying to run ChatGPT without defining chatGPTMessages");
  }
  const model = r.model as ChatGPTDef;
  const params:any = {
    "model": modelName === "ChatGPT" ? "gpt-3.5-turbo" : "gpt-4",
    "messages": r.chatGPTParams.messages,
    "temperature": model.temperature ?? 0.7,
    "max_tokens": model.maxTokens ?? 256,
    "top_p": 1,
    "frequency_penalty": 0,
    "presence_penalty": 0,
  }
  const res = await axios({
    url: "https://api.openai.com/v1/chat/completions",
    headers: {
      Authorization: "Bearer " + process.env.OPENAI_API_KEY, 
      "Content-Type": "application/json" 
    },
    method: "POST",
    data: JSON.stringify(params)
  });
  const response = await res.data;
  logger.log("Running ChatGPT, got response****", {response});
  if (response.choices && response.choices[0] && response.choices[0].message && response.choices[0].message.content) {
    if (r.chatGPTParams.schema) {
      const parsed = parseWithSchema(response.choices[0].message.content, r.chatGPTParams.schema);
      if (parsed !== null) {
        return {
          _context: {},
          generation: parsed,
          timeFulfilled: new Date().getTime(),
        }
      } else if (retries < MAX_RETRIES) {
        return runChatCompletion(modelName, r, retries+1);
      } else {
        throw new Error(`Failed to parse schema after ${retries} tries. Last response: ${JSON.stringify(response)}`)
      }
    } else {
      return {
        _context: {},
        generation: response.choices[0].content,
        timeFulfilled: new Date().getTime(),
      }  
    }
  } else {
    throw new Error(`ChatGPT runner failed with response: ${JSON.stringify(response)}`)
  }
}

async function runGPT3(r: GenerationRequest): GenerationPromise {
  if (!process.env.OPENAI_API_KEY) {
    throw new  Error("Missing OPENAI_API_KEY");
  }
  const model = r.model as GPT3Def;
  // TODO: where do we template? Eventually we might want multipart templates.
  // /\{1\}/g for global replacement.
  const prompt = r.template.template.replace(/\{1\}/g, r.prompt);
  const params:any = {
    "model": "text-davinci-003",
    "prompt": prompt,
    "temperature": model.temperature ?? 0.7,
    "max_tokens": model.maxTokens ?? 256,
    "top_p": 1,
    "frequency_penalty": 0,
    "presence_penalty": 0,
  }
  if (model.stopSequences) {
    params["stop"] = Object.entries(model.stopSequences).map(([_, v]) => v);
  }
  const res = await axios({
    url: "https://api.openai.com/v1/completions",
    headers: {
      Authorization: "Bearer " + process.env.OPENAI_API_KEY, 
      "Content-Type": "application/json" 
    },
    method: "POST",
    data: JSON.stringify(params)
  });
  const response = await res.data;
  if (response.choices && response.choices[0] && response.choices[0].text) {
    return {
      _context: {},
      generation: response.choices[0].text,
      timeFulfilled: new Date().getTime(),
    }
  } else {
    throw new Error(`GPT3 runner failed on response: ${JSON.stringify(response)}`)
  }
}

type GenerationPromise = Promise<GenerationResponse | Error>;
type Generator = (r: GenerationRequest) => GenerationPromise;
const runners:Record<Models, Generator>  = {
  "GPT3": runGPT3,
  "StableDiffusion": runStableDiffusion,
  "DALLE": runDalle,
  "ChatGPT": (r: GenerationRequest) => runChatCompletion("ChatGPT", r),
  "GPT4": (r: GenerationRequest) => runChatCompletion("GPT4", r),
}

export async function generate(r: GenerationRequest): Promise<GenerationResponse | Error> {
  if (runners[r.model.name]) {
    // TODO: what if this errors? Who is handling it, how?
    // We had a try/catch here before but the linter said it was useless.
    const g = await runners[r.model.name](r);
    return g;
  } else {
    throw new Error(`No generator defined for model: ${r.model.name}`);
  }
}
