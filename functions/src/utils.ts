export const chooseOne = <T,>(A: T[]) => {
  return A[Math.floor(Math.random() * A.length)];
}
