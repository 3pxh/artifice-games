import { h, Fragment } from "preact";
// TODO: Avatar.css
// Currently the class is defined elsewhere and that's no good!
export default function Avatar(props: {
  url: string,
  handle: string,
  size: number,
}) {
  return <img 
    class="Avatar"
    src={props.url} 
    alt={props.handle} 
    width={props.size} 
    height={props.size} />
}
