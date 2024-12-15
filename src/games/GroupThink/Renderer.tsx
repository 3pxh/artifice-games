import { h, Fragment } from "preact";
import { useContext, useState } from "preact/hooks";
import { computed, Signal, ReadonlySignal } from "@preact/signals";
import * as GroupThink from "../../../functions/src/games/groupthink";
import { AuthContext } from "../../AuthProvider";
import { messageRoom, updatePlayer, setScratchpad } from "../../actions";
import { TextOptions, ScoredTextOptions } from "../../components/TextOptions";
import SingleUseButton from "../../components/SingleUseButton";
import SubmittableInput from "../../components/SubmittableInput";

export const Subscriptions:Record<keyof GroupThink.Room["gameState"], boolean> = {
  "timer": false,
  "state": false,
  "round": false,
  "numRounds": false,
  "roundPromptPlayer": false,
  "roundPrompt": false,
  "playerOrder": false,
  "generations": false,
  "votes": false,
  "scores": false,
}

export function RenderGroupThink(props: {
  room: GroupThink.Room & {id: string},
  gameState: Signal<GroupThink.Room["gameState"]>,
  players: Signal<GroupThink.Room["players"]>,
  scratchpad: Signal<{input: string} | null>,
  isPlayer: boolean,
  isInputOnly: boolean,
}) {
  const { user } = useContext(AuthContext);
  const [fave, setFave] = useState<string | null>(null)
  if (!user) {
    throw new Error("User isn't defined in game renderer!");
  }
  
  const renderState:ReadonlySignal<GroupThink.State> = computed(() => {
    return (props.isPlayer && props.players.value)
      ? props.players.value[user.uid].state
      : props.gameState.value.state
  });
  const roundPromptAuthor = computed(() => props.gameState.value.roundPromptPlayer)
  const scratchpad = computed(() => props.scratchpad.value?.input ?? "");
  const roundPrompt = computed(() => props.gameState.value.roundPrompt)
  const roundPromptPrompt = computed(() => props.room.definition.roundPrompts[props.gameState.value.round % Object.keys(props.room.definition.roundPrompts).length])
  const generations = computed(() => {
    return props.gameState.value.generations;
  });
  const votes = computed(() => {
    return props.gameState.value.votes ?? {};
  });
  const players = computed(() => {
    return props.players.value;
  });
  
  const submit = (type: GroupThink.Message["type"], value: string) => {
    updatePlayer(props.room.id, { isReadyToContinue: true });
    message(type, value);
  }

  const message = (type: GroupThink.Message["type"], value: string) => {
    const m:Omit<GroupThink.Message, "uid"> = {
      type: type,
      value: value,
    }
    messageRoom(props.room.id, m);
  }

  /* Signals for asynchronous loads */
  const isReadyToContinue = computed(() => {
    return props.players.value[user.uid].isReadyToContinue;
  });
  const myImage = computed(() => {
    const g = props.gameState.value.generations;
    return (g && g[user.uid]) ? g[user.uid] : undefined;
  });
  const myVote = computed(() => {
    return props.gameState.value.votes ? (props.gameState.value.votes[user.uid] ?? undefined) : undefined;
  });
  /* End signals for asynchronous loads */
  
  if (renderState.value === "Lobby") {
    return <div class="PromptGuessLobby">
      <p>
        Welcome to GroupThink. You all create images, then pick one. The most popular image gets 0 points. Each other image and vote gets 1 point per person who picked it.
      </p>
      <SingleUseButton 
        key="LobbyContinue"
        buttonText="Ready to start!"
        hasBeenUsed={isReadyToContinue.value}
        onClick={() => {message("ReadyToContinue", "gogogo!")}}
        postSubmitContent={<>The game will start once everyone's ready.</>} />
    </div>
  } else if (renderState.value === "RoundPrompt") {
    if (roundPromptAuthor.value === user.uid) {
      return <SubmittableInput
        key="RoundPrompt"
        onSubmit={(v: string) => {submit("RoundPrompt", v)}}
        onChange={(v: string) => {setScratchpad(props.room.id, {input: v})}}
        label={roundPromptPrompt.value}
        submittedValue={roundPrompt.value}
        placeholder=""
        buttonText="So original!"
        postSubmitMessage="Starting the party..."
        maxLength={40} />
    } else {
      return<>
        <p>{roundPromptPrompt.value}</p>
        <p>{props.players.value[roundPromptAuthor.value].handle}: {scratchpad.value}</p>
      </>
    }
  } else if (renderState.value === "MakingImages") {
    return <>
      <p>{roundPromptPrompt.value}: {roundPrompt.value}</p>
      <SubmittableInput
        key="ImagePrompt"
        onSubmit={(v: string) => {submit("MakingImages", v)}}
        label="Make an image!"
        submittedValue={myImage.value ? myImage.value.prompt : undefined}
        placeholder=""
        buttonText="So original!"
        postSubmitMessage="Waiting on other players..."
        maxLength={80} />
        {(myImage.value && myImage.value.generation) && <img src={myImage.value.generation} />}
      </>
  } else if (renderState.value === "ViewingMasterpieces") {
    return <div style="width:100%;">
      <p>{roundPromptPrompt.value}: {roundPrompt.value}</p>
      {(myImage.value && myImage.value.generation) ? <img src={myImage.value.generation} style="width:100%" /> : <p>Generating your masterpiece...</p>}
      <SingleUseButton 
        buttonText="Ready to continue" 
        onClick={() => {message("ReadyToContinue", "gogogo!")}}
        postSubmitContent={<>Waiting on others</>} />
      </div>
  } else if (renderState.value === "Vote" && generations.value) {
    // TODO #async: show their vote if they already voted
    return <div style="width: 100%;">
      <p>{roundPromptPrompt.value}: {roundPrompt.value}</p>
      <p>Pick one.</p>
      <div style="width: 100%; display: flex; flex-wrap: wrap;">
        {Object.entries(generations.value).map(([uid, v]) => {
          if (myVote.value) {
            const style = (myVote.value === uid) ? "border: 2px solid #00ff00;" : "";
            return <img style={`max-width: 30%; border-radius:5px; margin: 1px 3px; box-sizing: border-box; ${style}`} src={v.generation} />  
          } else {
            const style = (fave === uid) ? "border: 2px solid #00ff00;" : "";
            return <img style={`max-width: 30%; border-radius:5px; margin: 1px 3px; box-sizing: border-box; ${style}`} src={v.generation} onClick={() => {setFave(uid)}} />  
          }
        })}
      </div>
      {fave && <SingleUseButton 
        buttonText="That's my fave" 
        onClick={() => {
          if (fave) {
            message("Vote", fave)
            setFave(null);
          }
        }}
        postSubmitContent={<>Waiting on others</>} />}
    </div>
  } else if (renderState.value === "Score" && generations.value) {
    const reversedVotes = Object.entries(votes.value).map(([key, value]) => [value, key]);
    let maxVotes = 0;
    const reversedNumVotes = Object.entries(votes.value).reduce((acc, [_, v]) => {
      acc[v] = (acc[v] ?? 0) + 1;
      maxVotes = Math.max(maxVotes, acc[v]);
      return acc;
    }, {} as {[k: string]: number});
    const pointValues = Object.entries(reversedNumVotes).reduce((acc, [uid, v]) => {
      acc[uid] = v === maxVotes ? -1 : v;
      return acc;
    }, {} as {[uid: string]: number});
    return <>
      <p>Here's what people picked</p>
      <div style="width: 100%; display: flex; flex-wrap: wrap; row-gap: 10px;">
        {Object.entries(generations.value).map(([uid, v]) => {
          const nullPoints = pointValues[uid] < 0;
          const pointVal = nullPoints ? 0 : pointValues[uid] ?? 0;
          return <div style="max-width: 30%; margin: 1px 3px; position:relative;">
            <img style="width:100%;  border-radius:5px;" src={v.generation} />
            <div style="position:absolute; top:-16px;">
              {reversedVotes.filter(([vote, _]) => vote === uid).map(([_, voter]) => {
                return <img key={Math.random()} style="width:32px; border-radius:50%;" src={players.value[voter].avatar} />
              })}
            </div>
            <div style={`position:absolute; bottom:0; right:0; color: ${nullPoints ? '#ff0000' : pointVal > 0 ? '#00ff00' : 'white'}`}>
              {pointVal}
            </div>
          </div>
        })}
      </div>
      <SingleUseButton 
        buttonText="Ready to continue" 
        onClick={() => {message("ReadyToContinue", "gogogo!")}}
        postSubmitContent={<>Waiting on others</>} />
    </>
  } else if (renderState.value === "Finish") {
    return <>
      <p>You're all winners!</p>
    </>
  } else {
    return <p>Congrats, you hit an unrecognized game state!</p>
  }
}
