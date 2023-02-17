# Onboard

Get yarn. Then `yarn install`. May need to specify to install along with the devDependencies.

Get the firebase CLI. Run `firebase login`. Make sure that you have access to the threepixelheart project with `firebase projects:list`.

In the toplevel directory, run `firebase init`.

* <small>Select the <span style="color:green">realtime database</span>, <span style="color:green">firestore</span>, <span style="color:green">functions</span>, <span style="color:green">cloud storage</span>.<br/></small>
* <small>When asked if it's an existing project, select the <span style="color:green">threepixelheart</span> project.<br/></small>
* <small>File database.rules.json already exists. Do you want to overwrite it with the Realtime Database Security Rules for threepixelheart-f5674-default-rtdb from the Firebase console? <span style="color:green">No</span><br/></small>
* <small>What file should be used for Firestore Rules? (firestore.rules) <span style="color:green">[enter]</span><br/></small>
* <small>File firestore.rules already exists. Do you want to overwrite it with the Firestore Rules from the Firebase Console? <span style="color:green">No</span><br/></small>
* <small>What file should be used for Firestore indexes? (firestore.indexes.json) <span style="color:green">[enter]</span><br/></small>
* <small>File firestore.indexes.json already exists. Do you want to overwrite it with the Firestore Indexes from the Firebase Console? <span style="color:green">No</span><br/></small>
* <small>What language would you like to use to write Cloud Functions? <span style="color:green">TypeScript</span><br/></small>
* <small>Do you want to use ESLint to catch probable bugs and enforce style? <span style="color:green">No</span><br/></small>
* <small>File functions/package.json already exists. Overwrite? <span style="color:green">No</span><br/></small>
* <small>File functions/tsconfig.json already exists. Overwrite? <span style="color:green">No</span><br/></small>
* <small>File functions/src/index.ts already exists. Overwrite? <span style="color:green">No</span><br/></small>
* <small>File functions/.gitignore already exists. Overwrite? <span style="color:green">No</span><br/></small>
* <small>Do you want to install dependencies with npm now? <span style="color:green">Yes</span><br/></small>
* <small>What file should be used for Storage Rules? (storage.rules) <span style="color:green">[enter]</span><br/></small>
* <small>File storage.rules already exists. Overwrite? <span style="color:green">No</span><br/></small>

# Install the billing extension

In the event that you need to work on billing, `firebase ext:install --local stripe/firestore-stripe-payments`. This requires keys from Stripe.
Additionally we want to test in local env with stripe, [https://dashboard.stripe.com/test/webhooks/create?endpoint_location=local]

Have to create products to have them sync in firestore :/ (it'd be nice if we could import once from Stripe)

# Developing

To serve the frontend, from the toplevel directory simply `yarn dev`. Vite rebuilds and re-serves stuff automatically. Default port 3000.

Make sure you have all the emulators with `firebase init emulators` and check off `functions`, `firestore`, `database`, `storage`, and `auth`. Auth is  required in order to account for the database access control rules. Firestore may soon be required for stripe billing data emulation.

To run firebase locally it helps to open up two terminals and cd functions in both. In one: `npm run emulate` and in the other: `npm run build:watch`. This allows hot reloading of the cloud functions as you work on them (whereas npm run emulate will only compile once).

That should run all the emulators (realtime databse, functions, and cloud storage) and show them with a nice UI. Default port 4000.

Local dev won't hit the production database, just the local emulated db. If in the future we need certain data in the db at boot then we'll add an initializer and check it in (and use --import-data)

If you like, add the preact devtools extension (preferably on a browser on which has no credentials/logins, as I haven't vetted what actually ships in the extension) https://preactjs.github.io/preact-devtools/

# Dev errors

If firebase emulators don't shut down properly, they can leave processes running which occupy the port. You'll notice because when you run `npm run emulate` you'll get an error like `Error: Could not start Storage Emulator, port taken.`. Track to find which port, for example `storage: Port 9199 is not open on localhost (127.0.0.1,::1), could not start Storage Emulator.`. Then find the process occupying the port, e.g. `lsof -i tcp:9199`,
COMMAND   PID     USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node    30594 hoqqanen   53u  IPv4 0xefe9db0c4f5f83a7      0t0  TCP localhost:9199 (LISTEN)

and kill it by referencing the PID column, e.g. `kill 30594` or `kill -9 30594` if it's not listening.