import { h, Fragment } from "preact";
import { Routes } from "../router";
import "./Welcome.css";

export default function Welcome() {
  return <div className="Welcome">
    <h1>Welcome</h1>
    <p>Artifice is a collection of AI-powered party games for 3-10 friends.</p>
    <h2>How to play</h2>
    <p>Each player uses a phone or computer as a controller. <a href="/auth">Log in</a>, start a game, and have your friends <a href="/join">join</a> with the room code.</p>
    <h2>Try it out now</h2>
    <p>Try the single player <a href="/intro">tutorial</a> to get a feel for the games.</p>
    <h2>About</h2>
    <p>Artifice is a labor of love by @hoqqanen, offering shared fun in the face of the unknown.</p>
  </div>
}
