import { route } from "preact-router";

export const Routes = {
  navigate: route,
  room: {
    pattern: "/room/:id",
    forId: (id: string) => `/room/${id}`
  }
}
