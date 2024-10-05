import axios, { AxiosError } from "axios";
import * as AWS from "aws-sdk";
import App from "./app";

export type Models =  "gpt-4o" | "StableDiffusion"
export type GPT4oDef = {
  name: "gpt-4o",
  stopSequences?: {
    [k: string]: string
  },
  maxTokens?: number,
  temperature?: number,
}
export type SDDef = {
  name: "StableDiffusion",
  version: "2.1" | "xl",
}
export type ModelDef = GPT4oDef | SDDef;
type Schema = {[key: string]: "string" | "number"};
// type ParsedSchema = {[key: string]: string | number};
export type GenerationRequest = {
  room: string,
  uid: string,
  model: ModelDef,
  template: {template: string},
  prompt: string,
  chatGPTParams?: {
    messages: {role: string, content: string}[],
    schema?: Schema,
  }
}

export type GenerationResponse<G> = {
  _context?: any,
  generation: G, // How do we type this given we may have Schemas passed to the generator?
  timeFulfilled?: number,
}

App.instance;
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY
});
const BUCKET_NAME = "artifice-games";

async function runStableDiffusion(r: GenerationRequest, tryCount = 0): GenerationPromise {
  if (!process.env.STABILITY_API_KEY) {
    throw new Error("Missing STABILITY_API_KEY");
  }
  
  const MAX_TRIES = 2;
  // We don't use the model def at the moment, just the cheapest.
  // const model = r.model as SDDef;

  const prompt = r.template.template.replace("{1}", r.prompt);

  let response;
  try {
    response = await axios({
      url: "https://api.stability.ai/v2beta/stable-image/generate/core",
      method: "POST",
      responseType: "stream",
      headers: {
        "Content-Type": "multipart/form-data",
        Authorization: `Bearer ${process.env.STABILITY_API_KEY}`,
        Accept: "image/*",
      },
      data: {
        prompt: prompt,
        output_format: "png"
      },
    })
    // response.data.pipe(fs.createWriteStream('./lighthouse.png'))
  } catch (e) {
    const err = e as AxiosError<unknown, any>;
    throw new Error("The call to stable diffusion failed with error: " + err.message)
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

function parseWithSchema(res: string, schema: Schema) {
  try {
    const parsed = JSON.parse(res);
    const isValid = Object.entries(schema).every(([n, t]) => {
      return (parsed[n] !== undefined) && (typeof(parsed[n]) === t);
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

async function runChatCompletion(modelName: "gpt-4o", r: GenerationRequest, retries=1): GenerationPromise {
  const MAX_RETRIES = 2;
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY");
  }
  let messages = [];
  if (!r.chatGPTParams) {
    const prompt = r.template.template.replace("{1}", r.prompt);
    messages = [
      {role: "system", content: "You are a helpful assistant."},
      {role: "user", content: prompt},
    ];
  } else {
    messages = r.chatGPTParams.messages;
  }
  const model = r.model as GPT4oDef;
  const params:any = {
    "model": modelName,
    "messages": messages,
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
  if (response.choices && response.choices[0] && response.choices[0].message && response.choices[0].message.content) {
    if (r.chatGPTParams && r.chatGPTParams.schema) {
      const parsed = parseWithSchema(response.choices[0].message.content, r.chatGPTParams.schema);
      if (parsed !== null) {
        return {
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
        generation: response.choices[0].message.content,
        timeFulfilled: new Date().getTime(),
      }  
    }
  } else {
    throw new Error(`ChatGPT runner failed with response: ${JSON.stringify(response)}`)
  }
}


type GenerationPromise = Promise<GenerationResponse<any> | Error>;
type Generator = (r: GenerationRequest) => GenerationPromise;
const runners:Record<Models, Generator>  = {
  "StableDiffusion": runStableDiffusion,
  "gpt-4o": (r: GenerationRequest) => runChatCompletion("gpt-4o", r),
}

export async function generate(r: GenerationRequest): Promise<GenerationResponse<any> | Error> {
  if (runners[r.model.name]) {
    // TODO: what if this errors? Who is handling it, how?
    // We had a try/catch here before but the linter said it was useless.
    const g = await runners[r.model.name](r);
    return g;
  } else {
    throw new Error(`No generator defined for model: ${r.model.name}`);
  }
}
