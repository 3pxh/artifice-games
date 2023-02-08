import * as admin from "firebase-admin";

/*
  It seems that we need this singleton because firebase complains
  that the app is not initialized before use in generate, despite
  it being initialized in index. This singleton is a provider for
  both without calling initializeApp() more than once (which also
  throws an error).
*/
export default class App {
    private static _intance: App;
    db: any;
    private constructor() {

      admin.initializeApp();
        // admin.initializeApp({
          // TODO: add credentials
          // credential: admin.app.cert(serviceAccountJsonFile)
          // databaseURL: "https://threepixelheart-f5674-default-rtdb.firebaseio.com/",
          // storageBucket: "threepixelheart-f5674.appspot.com",
        // });
        // this.db = admin.database();
    }

    public static get instance() {
        return this._intance || (this._intance = new this());
    }

}
