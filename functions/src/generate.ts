import { logger } from "firebase-functions";
import axios from "axios";

export type Models =  "GPT3" | "StableDiffusion"
export type GenerationRequest = {
  uid: string,
  model: Models,
  template: {template: string},
  prompt: string,
}

type GenerationResponse = {
  _context: any,
  generation: string,
}

async function runStableDiffusion(r: GenerationRequest, tryCount = 0): GenerationPromise {
  logger.log("Running Stable Diffusion");
  if (!process.env.STABILITY_API_KEY) {
    throw new Error("Missing STABILITY_API_KEY");
  }
  
  const MAX_TRIES = 2;
  // TODO: Choose between 2.0 and 1.5 in the request.
  const engineId = "stable-diffusion-512-v2-0";
  const apiHost = "https://api.stability.ai";
  const url = `${apiHost}/v1alpha/generation/${engineId}/text-to-image`;

  const prompt = r.template.template.replace("{1}", r.prompt);
  const response = await axios({
      url: url,
      method: "POST",
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
    }
  );

  if (!response || !response.headers) {
    throw new Error("Request to Stable Diffusion failed")
  }

  logger.log("Got SD response", {headers: response.headers});

  if (response.headers["goa-error"] === "invalid_prompts") {
    throw new Error("Your prompt was not valid and may have contained filtered words.")
  } else if (response.headers["goa-error"]) {
    throw new Error(`StableDiffusion goa-error: ${response.headers["goa-error"]}`)
  } else if (tryCount < MAX_TRIES && response.headers["finish-reason"] !== "SUCCESS") {
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

  return {
    _context: {seed: response.headers["seed"]},
    generation: "Stable diffusion succeeded, need to save and get the url",
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
    const g = await runners[r.model](r);
    return g;
  } else {
    throw new Error(`No generator defined for model: ${r.model}`);
  }
}
