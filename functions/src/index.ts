
/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import * as functions from 'firebase-functions';
import next from 'next';

const dev = process.env.NODE_ENV !== 'production';
// Adjust the 'dir' option to point to the project root relative to the functions directory
// Assuming the function runs from 'functions/lib', '../' points to the project root.
const app = next({ dev, dir: '../' });
const handle = app.getRequestHandler();

export const nextjsServer = functions.https.onRequest(
  async (req: functions.https.Request, res: functions.Response) => {
    await app.prepare();
    handle(req, res);
  }
);
