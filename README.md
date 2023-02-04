# Onboard

Get yarn. Then `yarn install`. May need to specify to install along with the devDependencies.

Get the firebase CLI. Run `firebase login`. Make sure that you have access to the threepixelheart project with `firebase projects:list`.

In the toplevel directory, run `firebase init`.

* <small>Select the <span style="color:green">realtime database</span> and <span style="color:green">functions</span>.<br/></small>
* <small>When asked if it's an existing project, select the <span style="color:green">threepixelheart</span> project.<br/></small>
* <small>File database.rules.json already exists. Do you want to overwrite it with the Realtime Database Security Rules for threepixelheart-f5674-default-rtdb from the Firebase console? <span style="color:green">No</span><br/></small>
* <small>What language would you like to use to write Cloud Functions? <span style="color:green">TypeScript</span><br/></small>
* <small>Do you want to use ESLint to catch probable bugs and enforce style? <span style="color:green">No</span><br/></small>
* <small>File functions/package.json already exists. Overwrite? <span style="color:green">No</span><br/></small>
* <small>File functions/tsconfig.json already exists. Overwrite? <span style="color:green">No</span><br/></small>
* <small>File functions/src/index.ts already exists. Overwrite? <span style="color:green">No</span><br/></small>
* <small>File functions/.gitignore already exists. Overwrite? <span style="color:green">No</span><br/></small>
* <small>Do you want to install dependencies with npm now? <span style="color:green">Yes</span><br/></small>


# Developing

To serve the frontend, from the toplevel directory simply `yarn dev`. Vite rebuilds and re-serves stuff automatically. Default port 3000.

To run firebase locally it helps to open up two terminals and cd functions in both. In one: `npm run emulate` and in the other: `npm run build:watch`. This allows hot reloading of the cloud functions as you work on them (whereas npm run emulate will only compile once).

That should run all the emulators (realtime databse and functions) and show them with a nice UI. Default port 4000.

Local dev won't hit the production database, just the local emulated db. If in the future we need certain data in the db at boot then we'll add an initializer and check it in (and use --import-data)

If you like, add the preact devtools extension (preferably on a browser on which has no credentials/logins, as I haven't vetted what actually ships in the extension) https://preactjs.github.io/preact-devtools/
