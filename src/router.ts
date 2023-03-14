import { route } from "preact-router";

export const Routes = {
  navigate: route,
  room: {
    pattern: "/room/:id",
    forId: (id: string) => `/room/${id}`
  },
  newGame: {
    href: "/create",
    forName: (name: string) => `/create/${name}`
  },
  auth: {
    href: "/auth",
  },
  intro: {
    href: "/intro",
  }
}
