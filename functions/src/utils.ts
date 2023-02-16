export const chooseOne = <T,>(A: T[]) => {
  return A[Math.floor(Math.random() * A.length)];
}

export const chooseOneInObject = <T,>(A: {[k: string]: T}) => {
  return chooseOne(Object.entries(A))[1];
}

export const shuffle = <T>(A: T[], seed?: number) => {
  const rand = seed ? mulberry32(seed) : Math.random;
  return A.map(value => ({ value, sort: rand() }))
          .sort((a, b) => a.sort - b.sort)
          .map(({ value }) => value);
}

export const objectMap = <V,O,>(obj:{[k: string]: V}, fn:(v: V, k: string, i: number) => O) =>
  Object.fromEntries(
    Object.entries(obj).map(
      ([k, v], i) => [k, fn(v, k, i)]
    )
  )

//https://stackoverflow.com/questions/521295/seeding-the-random-number-generator-in-javascript
function mulberry32(a?: number) {
  let seed = a ?? seed32bit();
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

export const seed32bit = () => {
  return Math.floor(Math.random()*2**32);
}


import { Generation } from "./games/aiJudge";
export const JudgeUtils = {
  LETTERS: "ABCDEFGHIJKLMNOP",
  choiceUid(g: Generation) {
    const choice = g.generation.toUpperCase().trim().charAt(0);
    if (JudgeUtils.LETTERS.indexOf(choice) !== undefined) {
      const uid = Object.keys(g.answers).find((k) => {
        return g.answers[k].letter === choice;
      });
      return uid;
    } else {
      return undefined;
    }
  },
  pointValues: {
    authorOfTruth: 5,
    votedTruth: 3,
    authorOfTruthVote: 1,
    authorOfLieVote: 1,
  }
}
