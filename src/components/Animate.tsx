import { h, Fragment } from "preact";
import "animate.css"; // https://animate.style/

export default function Animate(props: {children: any, onEnter: string, onExit: string, isVisible: boolean, hasRendered: boolean}) {
  return <div 
  className={`animate__animated ${props.isVisible ? props.onEnter : props.onExit}`} 
  style={`position: absolute; top: 0; ${props.hasRendered ? "display: visible;" : "display: none;"}`}>
    {props.children}
  </div>
}
