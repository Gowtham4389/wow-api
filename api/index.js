import { createApp } from '../server/src/app.js';

// Vercel supplies the listener; share the existing Express routes.
export default createApp();
