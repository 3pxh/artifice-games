# Onboard

Get yarn. Then `yarn install`. May need to specify to install along with the devDependencies.

Get the firebase CLI. Run `firebase login`. Make sure that you have access to the threepixelheart project with `firebase projects:list`.

In the toplevel directory, run `firebase init`. Select the realtime database, functions, and cloud storage. When asked if it's an existing project, select the threepixelheart project. Don't overwrite any of the files.

# Developing

To serve the frontend, from the toplevel directory simply `yarn dev`. Vite rebuilds and re-serves stuff automatically.

To run firebase locally it helps to open up two terminals and `cd functions` in both.
In one: `npm run emulate` and in the other: `npm run build:watch`. This allows hot reloading of the cloud functions as you work on them (whereas `npm run emulate` will only compile once).

That should run all the emulators (realtime databse and functions) and show them with a nice UI on the appropriate port.

Local dev won't hit the production database, just the local emulated db. If in the future we need certain data in the db at boot then we'll add an initializer and check it in (and use --import-data)
