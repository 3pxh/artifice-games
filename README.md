# Onboard

Get yarn. Then `yarn install`. May need to specify to install along with the devDependencies.

Get the firebase CLI. Run `firebase login`. Make sure that you have access to the threepixelheart project with `firebase projects:list`.

In the toplevel directory, run `firebase init`. Select the realtime database and functions. When asked if it's an existing project, select the threepixelheart project.

# Developing

To serve the frontend, from the toplevel directory simply `yarn dev`. Vite rebuilds and re-serves stuff automatically.

To run firebase locally,
`cd functions`
`npm run emulate`

That should run all the emulators (realtime databse and functions) and show them with a nice UI on the appropriate port.

Local dev won't hit the production database, just the local emulated db. If in the future we need certain data in the db at boot then we'll add an initializer and check it in (and use --import-data)
