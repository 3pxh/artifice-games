import { h, Fragment, JSX } from "preact";
import { useState } from "preact/hooks";
import { Routes } from "../router";
import Animate from "../components/Animate";
import SubmittableInput from "../components/SubmittableInput";
import "./Intro.css";
import imageSrc from "../../assets/intro_example.png";

export const INTRO_STATE_STORAGE_KEY = "Intro-Finished";
type Media = "poem" | "image" | "list";
// "https://artifice-1.s3.us-west-2.amazonaws.com/images/StableDiffusion/-NQWFFRyTulHHSpxNjWI/1068966989.png";
const IntroData:Record<Media, {content:(string | JSX.Element), choices:string[], preface: string}> = {
  poem: {
    content: "\
Peaceful moments pass\n\
A warm cup in my hands, still\n\
The sun fades away",
    choices: [
      "write a haiku about a cozy Sunday",
      "write a haiku about when the kids are at school",
      "write a haiku about drinking tea",
    ],
    preface: "write a haiku about",
  },
  image: {
    content: <img src={imageSrc}/>,
    choices: [
      "a game about ecology",
      "ecotopia is a place in the mind",
      "Welcome to Ecotopia!",
    ],
    preface: "make an image of",
  },
  list: {
    content: "\
1. Fun & Entertainment\n\
2. Exercise & Cardio\n\
3. Practicing Agility & Coordination\n\
4. Quality Bonding Time\n\
5. Provides Stimulation & Mental Stimulation",
    choices: [
      "top 5 reasons you should play Dog polo",
      "top 5 reasons you should take your kid on a walk",
      "top 5 reasons you should chase your Roomba",
    ],
    preface: "top 5 reasons you should",
  },
}

// Preload image
const image = new Image();
image.src = imageSrc;
const urlToFile = async(url: string)=> {
  const response = await fetch(url);
  const blob = await response.blob();
  return new File([blob], 'image.png', {type: blob.type});
}

export default function Intro() {
  const [stage, setStage] = useState(0);
  const [mediaType, setMediaType] = useState<Media | null>(null);
  const [guessedCorrectly, setGuessedCorrectly] = useState(false);
  const [lie, setLie] = useState("");

  const setMedia = (media: Media) => {
    setMediaType(media);
    setStage(1);
  }

  const choose = (isCorrect: boolean) => {
    setGuessedCorrectly(isCorrect);
    setStage(2);
  }

  const submitLie = (lie: string) => {
    setLie(lie);
    setStage(4);
  }

  const end = () => {
    window.localStorage.setItem(INTRO_STATE_STORAGE_KEY, "true");
    Routes.navigate(Routes.auth.href);
  }

  const LETTERS = "ABCDEF";
  return <div className="Intro">
    <Animate hasRendered={stage >= 0} isVisible={stage === 0} onEnter="animate__fadeInUp" onExit="animate__fadeOutUp">
      <div style="display:flex; flex-direction: column;">
        <h2>Welcome! 🤖🎨🕹️</h2>
        <h3>Show me a...</h3>
        <button onClick={() => setMedia("poem")}>📓 poem ✍️</button>
        <button onClick={() => setMedia("image")}>🖼️ picture 🎨</button>
        <button onClick={() => setMedia("list")}>🗒️ silly list 😂</button>
        <a href="#" onClick={end} className="Intro-Skip">Skip intro and login</a>
      </div>
    </Animate>
    <Animate hasRendered={stage >= 1} isVisible={stage === 1} onEnter="animate__fadeInUp" onExit="animate__fadeOutUp">
      <div style="display:flex; flex-direction: column;">
        <span>A computer made this {mediaType}:</span>
        <span className="Intro-Generation">{mediaType ? IntroData[mediaType].content : ""}</span>
        <span>What prompted it?</span>
        {mediaType 
        ? IntroData[mediaType].choices.map((choice, i) => 
          <button onClick={() => choose(i === 2)}>{choice}</button>
        )
        : ""}
      </div>
    </Animate>
    <Animate hasRendered={stage >= 2} isVisible={stage === 2} onEnter="animate__fadeInUp" onExit="animate__fadeOutUp">
      <div style="display:flex; flex-direction: column;">
        {mediaType ? <span>
          {guessedCorrectly 
          ? "You got it right! The other answers were made up by people who saw it." 
          : `Nope, someone made that up after seeing it and fooled you! The real prompt was "${IntroData[mediaType].choices[2]}"`}
        </span> : ""}
        <button onClick={() => setStage(3)}>Continue</button>
      </div>
    </Animate>
    <Animate hasRendered={stage >= 3} isVisible={stage === 3} onEnter="animate__fadeInUp" onExit="animate__fadeOutUp">
      <div style="display:flex; flex-direction: column;">
        <span>Now it's your turn to fool others. Write in a prompt you think your friends will pick.</span>
        <span className="Intro-Generation">{mediaType ? IntroData[mediaType].content : ""}</span>
        <SubmittableInput 
          label={mediaType ? `${IntroData[mediaType].preface}...` : ""}
          buttonText={"Continue"}
          onSubmit={submitLie}
        />
      </div>
    </Animate>
    <Animate hasRendered={stage >= 4} isVisible={stage === 4} onEnter="animate__fadeInUp" onExit="animate__fadeOutUp">
      <div style="display:flex; flex-direction: column;">
        <div style="display:flex; flex-direction: column; border: 1px solid white; padding: 5px;">
          <span>A computer made this {mediaType}:</span>
          <span className="Intro-Generation">{mediaType ? IntroData[mediaType].content : ""}</span>
          <span>What prompted it?</span>
          {mediaType 
          ? IntroData[mediaType].choices.map((choice, i) => 
            <span>{LETTERS.charAt(i)}) {choice}</span>
          )
          : ""}
          <span>{`${LETTERS.charAt(3)}) ${(mediaType ? IntroData[mediaType].preface : "")} ${lie}`}</span>
          <span style="text-align:center;">www.artifice.games</span>
        </div>
        <span>Share with your friends and find out if you fooled them!</span>
        {!navigator.canShare 
        ? <span>It looks like the share button doesn't work on your browser. Take a screenshot instead.</span>
        : <button onClick={async () => {
          const prompts = IntroData[mediaType!].choices.concat([`${IntroData[mediaType!].preface} ${lie}`]).map((c, i) => {
            return `${LETTERS.charAt(i)}) ${c}`;
          }).join("\n");
          if (mediaType === "image") {
            const img = await urlToFile(imageSrc);
            navigator.share({
              title: "Artifice Games",
              text: `Guess the real prompt:\n${prompts}`,
              url: "https://artifice.games",
              files: [img]})
          } else {
            navigator.share({
              text: `A computer made this ${mediaType}:\n${IntroData[mediaType!].content}\n\nGuess the real prompt:\n${prompts}\n\nPlay at https://artifice.games`})
          }
          
        }}>Share</button>}
        <button onClick={() => setStage(5)}>continue</button>
      </div>
    </Animate>
    <Animate hasRendered={stage >= 5} isVisible={stage === 5} onEnter="animate__fadeInUp" onExit="animate__fadeOutUp">
      <div style="display:flex; flex-direction: column;">
        <span>
          That's the gist of Artifice. Tell the AI to make images, poems, listicles, and more!
        </span>
        <span>
          There's even a game where you give the AI multiple choice questions and see what it thinks.
        </span>
        <span>
          Play live with your friends for points, or just for the laughs.
        </span>
        <a href="#" onClick={end} className="Intro-Final">Log in to start a game</a>
      </div>
    </Animate>
  </div>
}
