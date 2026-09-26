// lib/db.ts
import { createClient } from '@turso/sdk';

const client = createClient({
  url: process.env.TURSO_DB_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

export default client;
