# Artifice Games

# Developing in codebase

## Install and configure dependencies 
1. Install [Yarn](https://yarnpkg.com/)
   - May need to specify to install along with the devDependencies.
2. Run `yarn install` from top-level directory
3. Install [Java 19.02](https://www.oracle.com/java/technologies/javase/jdk19-archive-downloads.html) for your OS
4. Install the [Firebase CLI](https://firebase.google.com/docs/cli) `npm install -g firebase-tools`
5. Message George to be added to **threepixelheart** Firebase project
   - Confirm that you have access to the project with `firebase projects:list`
6. Run `firebase login` and authenticate with your Google account
7. Run `firebase init` from top-level directory
8. When asked if it's an existing project, select the **threepixelheart** project.
9. Answer the following prompts as such:
   - Select these with the `space` key:
     - **realtime database**
     - **firestore**
     - **functions**
     - **cloud storage**
   - File database.rules.json already exists. Do you want to overwrite it with the Realtime Database Security Rules for threepixelheart-f5674-default-rtdb from the Firebase console? (y/N) 
     - **N**
   - What file should be used for Firestore Rules? (firestore.rules) 
     - **[Enter]**
   - File firestore.rules already exists. Do you want to overwrite it with the Firestore Rules from the Firebase Console? (y/N) 
     - **N**
   - What file should be used for Firestore indexes? (firestore.indexes.json) 
     - **[Enter]**
   - File firestore.indexes.json already exists. Do you want to overwrite it with the Firestore Indexes from the Firebase Console? (y/N)
     - **N**
   - Would you like to initialize a new codebase, or overwrite an existing one? (Use arrow keys)
     - **Overwrite**
   - What language would you like to use to write Cloud Functions? (Use arrow keys)
     - **TypeScript**
   - Do you want to use ESLint to catch probable bugs and enforce style? (Y/n) 
     - **N**
   - File functions/package.json already exists. Overwrite? (y/N) 
     - **N**
   - File functions/tsconfig.json already exists. Overwrite? (y/N) 
     - **N**
   - File functions/src/index.ts already exists. Overwrite? (y/N) 
     - **N**
   - File functions/.gitignore already exists. Overwrite? (y/N) 
     - **N**
   - Do you want to install dependencies with npm now? (Y/n) 
     - **Y**
   - What file should be used for Storage Rules? (storage.rules) 
     - **[Enter]**
   - File storage.rules already exists. Overwrite? (y/N) 
     - **N**

## Run local dev environments
1. Run `yarn dev` from top-level directory
   - > Vite rebuilds and re-serves stuff automatically. View preview at https://localhost:3000
2. Run `firebase init emulators` and answer the following prompts as such:
   - Select these with the `space` key:
     - **functions**
     - **firestore**
     - **database**
     - **storage**
     - **auth**
     - > Auth is required to account for the database access control rules. Firestore may soon be required for stripe billing data emulation.
3. Run firebase
   -  In a new tab: `cd functions; npm run emulate`
      -  > This will run all emulators (e.g., realtime databse, functions, and cloud storage) and show them with a nice UI. View at https://localhost:4000
   -  In a new tab: `cd functions; npm run build:watch`
      - > This allows hot reloading of the cloud functions as you work on them (whereas npm run emulate will only compile once).

Local dev won't hit the production database, just the local emulated database. If in the future we need certain data in the database at boot then we'll add an initializer and check it in (and use --import-data).

If you like, add the [preact devtools extension](https://preactjs.github.io/preact-devtools/). Preferably, use a browser with no credentials/logins, as I haven't vetted what actually ships in the extension.

## Dev errors
You may run into an issue where ports are already in use, causing aspects of the development environment to fail. This can happen if Firebase emulators don't shut down properly.

If you run into an error running `npm run emulate` that resembles:

```
storage: Port 9199 is not open on localhost (127.0.0.1,::1), could not start Storage Emulator.
```

You'll need to find the process occupying the port:

```
lsof -i tcp:9199
```

This command will provide a result similar to:

```
COMMAND   PID     USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node    30594 hoqqanen   53u  IPv4 0xefe9db0c4f5f83a7      0t0  TCP localhost:9199 (LISTEN)
```

This process can be killed by referencing the PID column value using the `kill` command: `kill 30594` or `kill -9 30594` if it's not listening.

You can substitute **9199** with whichever port number is in use.

## Avatars

Avatars need to be manually added to Firebase Storage when developing locally:

1. Spin up the development environment
2. Navigate to Firebase Emulators UI at https://localhost:4000
3. Click "Storage" in top navigation
4. Create folder named `avatars`
5. Upload all avatars into newly-created folder

## Billing
In the event that you need to work on billing, you can run the following commands to configure and run Stripe: 

1. Run `firebase ext:install --local stripe/firestore-stripe-payments`
   - This requires keys from Stripe. Additionally we want to test in local env with Stripe, [https://dashboard.stripe.com/test/webhooks/create?endpoint_location=local]
   - > **TODO:** Have to create products to have them sync in firestore. It'd be nice if we could import once from Stripe.
2. Forward webhook events to your local machine:
   -  `stripe login`
   -  `stripe listen --forward-to http://127.0.0.1:5001/threepixelheart-f5674/us-central1/ext-firestore-stripe-payments-handleWebhookEvents`
   -  > These commands will produce a webhook secret.
3. Configure Stripe on your local machine by creating `extensions/firestore-stripe-payments.secret.local` with the following:
    ```
    STRIPE_API_KEY=rk_test_...
    STRIPE_WEBHOOK_SECRET=whsec_...
    ```
   - > This can also be done by using `firebase ext:configure firestore-stripe-payments --local` but don't check-in the resulting `firestore-stripe-payments.env`.