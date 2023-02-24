import { h, Fragment } from 'preact'
import { useContext, useEffect, useState } from 'preact/hooks'
import { ref, onValue } from "@firebase/database";
import { Link } from 'preact-router';
import { MembershipData } from '../functions/src';
import { db } from "./firebaseClient";
import { AuthContext } from './AuthProvider'

type roomId = string
export default function GameList(props: {filter: string}) {
  const authContext = useContext(AuthContext);
  const [isLoaded, setIsLoaded] = useState(false);
  const [games, setGames] = useState<[roomId, MembershipData][]>([]);

  useEffect(() => {
    if (authContext.user) {
      const isActive = props.filter === "active";
      const membershipsRef = ref(db, `memberships/${authContext.user.uid}`);
      onValue(membershipsRef, (v) => {
        const memberships = (v.val() as {[rid: roomId]: MembershipData}) ?? {};
        setGames(Object.entries(memberships).filter(([_, m]) => {
          const now = new Date().getTime();
          const twoHours = 2*3600*1000;
          if (isActive) {
            return m.isAsync || (now - m.timestamp < twoHours);
          } else {
            return !(m.isAsync || (now - m.timestamp < twoHours));
          }
        }));
        setIsLoaded(true);
      });
    }
  })

  if (!isLoaded) {
    return <>Loading games...</>
  } else if (games.length === 0) {
    return <>No {props.filter} games here yet.</>
  } else {
    return <div class="GameList">
      {games.map(([r, m]) => {
        const date = new Date(m.timestamp).toLocaleDateString('en-us', { weekday:"long", month:"short", day:"numeric"});
        return <Link href={`/room/${r}`}>
          <div class="GameList-Game">
            <span class="GameList-Date">{date}</span>
            <h3 class="GameList-Name">{m.gameName}</h3>
          </div>
        </Link>
      })}
    </div>
  }
  
}