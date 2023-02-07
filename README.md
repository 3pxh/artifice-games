# Onboard

Get yarn. Then `yarn install`. May need to specify to install along with the devDependencies.

Get the firebase CLI. Run `firebase login`. Make sure that you have access to the threepixelheart project with `firebase projects:list`.

In the toplevel directory, run `firebase init`.

* <small>Select the <span style="color:green">realtime database</span>, <span style="color:green">functions</span>, and <span style="color:green">cloud storage</span>.<br/></small>
* <small>When asked if it's an existing project, select the <span style="color:green">threepixelheart</span> project.<br/></small>
* <small>File database.rules.json already exists. Do you want to overwrite it with the Realtime Database Security Rules for threepixelheart-f5674-default-rtdb from the Firebase console? <span style="color:green">No</span><br/></small>
* <small>What language would you like to use to write Cloud Functions? <span style="color:green">TypeScript</span><br/></small>
* <small>Do you want to use ESLint to catch probable bugs and enforce style? <span style="color:green">No</span><br/></small>
* <small>File functions/package.json already exists. Overwrite? <span style="color:green">No</span><br/></small>
* <small>File functions/tsconfig.json already exists. Overwrite? <span style="color:green">No</span><br/></small>
* <small>File functions/src/index.ts already exists. Overwrite? <span style="color:green">No</span><br/></small>
* <small>File functions/.gitignore already exists. Overwrite? <span style="color:green">No</span><br/></small>
* <small>Do you want to install dependencies with npm now? <span style="color:green">Yes</span><br/></small>
* <small>What file should be used for Storage Rules? (storage.rules) <span style="color:green">[enter]</span><br/></small>
* <small>File storage.rules already exists. Overwrite? <span style="color:green">No</span><br/></small>

# Developing

To serve the frontend, from the toplevel directory simply `yarn dev`. Vite rebuilds and re-serves stuff automatically. Default port 3000.

To run firebase locally it helps to open up two terminals and cd functions in both. In one: `npm run emulate` and in the other: `npm run build:watch`. This allows hot reloading of the cloud functions as you work on them (whereas npm run emulate will only compile once).

That should run all the emulators (realtime databse, functions, and cloud storage) and show them with a nice UI. Default port 4000.

Local dev won't hit the production database, just the local emulated db. If in the future we need certain data in the db at boot then we'll add an initializer and check it in (and use --import-data)

If you like, add the preact devtools extension (preferably on a browser on which has no credentials/logins, as I haven't vetted what actually ships in the extension) https://preactjs.github.io/preact-devtools/

# Dev errors

If firebase emulators don't shut down properly, they can leave processes running which occupy the port. You'll notice because when you run `npm run emulate` you'll get an error like `Error: Could not start Storage Emulator, port taken.`. Track to find which port, for example `storage: Port 9199 is not open on localhost (127.0.0.1,::1), could not start Storage Emulator.`. Then find the process occupying the port, e.g. `lsof -i tcp:9199`,
COMMAND   PID     USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node    30594 hoqqanen   53u  IPv4 0xefe9db0c4f5f83a7      0t0  TCP localhost:9199 (LISTEN)

and kill it by referencing the PID column, e.g. `kill 30594` or `kill -9 30594` if it's not listening.