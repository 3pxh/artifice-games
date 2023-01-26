import { h, Fragment } from 'preact'
// import { message } from './Firebase'
import { Logo } from './logo'

export function App() {
  // message({name: "yo yo yo"})
  return (
    <>
      <Logo />
      <p>Hello Vite + Preact!</p>
      <p>
        <a
          class="link"
          href="https://preactjs.com/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn Preact
        </a>
      </p>
    </>
  )
}