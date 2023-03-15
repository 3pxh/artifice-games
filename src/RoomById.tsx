import { h, Fragment } from 'preact'
import { useContext, useEffect, useState } from 'preact/hooks'
import { getRoom } from './actions';
import { RoomData } from "./Room";
import { AuthContext } from './AuthProvider'
import { Room } from './Room';

export default function RoomById(props: {id: string}) {
  const authContext = useContext(AuthContext);
  const [room, setRoom] = useState<RoomData | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (authContext.user && !isLoaded) {
      getRoom(props.id, (r: RoomData) => {
        setIsLoaded(true);
        setRoom({...r, id: props.id});
      });
    }
  }, [authContext.user])

  
  if (!isLoaded) {
    return <>Loading...</>
  } else if (!room) {
    return <>Room not found!</>
  } else {
    return <Room room={{
      ...room,
      // TODO: should we store these / deduce them?
      isPlayer: true,
      isInputOnly: false,
    }} />
  }
}