import { getStorage } from "firebase-admin/storage";
import { logger } from "firebase-functions";
import axios, { AxiosError } from "axios";
import App from "./app";

export type Models =  "GPT3" | "StableDiffusion"
export type GenerationRequest = {
  room: string,
  uid: string,
  model: Models,
  template: {template: string},
  prompt: string,
}

export type GenerationResponse = {
  _context?: any,
  generation: string,
  timeFulfilled?: number,
}

App.instance;
const storage = getStorage();

async function runStableDiffusion(r: GenerationRequest, tryCount = 0): GenerationPromise {
  logger.log("Running Stable Diffusion");
  if (!process.env.STABILITY_API_KEY) {
    throw new Error("Missing STABILITY_API_KEY");
  }
  
  const MAX_TRIES = 2;
  // TODO: Choose between 2.0 and 1.5 in the request, or on the room.
  const engineId = "stable-diffusion-512-v2-0";
  const apiHost = "https://api.stability.ai";
  const url = `${apiHost}/v1alpha/generation/${engineId}/text-to-image`;

  const prompt = r.template.template.replace("{1}", r.prompt);
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
        seed: 0,
        steps: 30,
        text_prompts: [
          {
            text: prompt,
            weight: 1
          }
        ],
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
  const filename = `images/StableDiffusion/${r.room}/${prompt}_${seed}.png`;
  const s = storage.bucket().file(filename).createWriteStream();
  await response.data.pipe(s);

  return {
    _context: {
      seed: seed, 
      // TODO: include full model parameters?
    },
    generation: filename,
    timeFulfilled: new Date().getTime(),
  }
}

async function runGPT3(r: GenerationRequest): GenerationPromise {
  if (!process.env.OPENAI_API_KEY) {
    throw new  Error("Missing OPENAI_API_KEY");
  }
  // TODO: where do we template? Eventually we might want multipart templates.
  const prompt = r.template.template.replace("{1}", r.prompt);
  const res = await axios({
    url: "https://api.openai.com/v1/completions",
    headers: {
      Authorization: "Bearer " + process.env.OPENAI_API_KEY, 
      "Content-Type": "application/json" 
    },
    method: "POST",
    data: JSON.stringify({
      "model": "text-davinci-003",
      "prompt": prompt,
      "temperature": 0.7,
      "max_tokens": 256,
      "top_p": 1,
      "frequency_penalty": 0,
      "presence_penalty": 0
    })
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
}

export async function generate(r: GenerationRequest): Promise<GenerationResponse | Error> {
  if (runners[r.model]) {
    try {
      const g = await runners[r.model](r);
      return g;
    } catch(e) {
      throw e;
    }
  } else {
    throw new Error(`No generator defined for model: ${r.model}`);
  }
}
