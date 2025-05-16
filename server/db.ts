import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Configure neon websocket only when using neon database
if (process.env.DATABASE_URL?.includes('neon')) {
  neonConfig.webSocketConstructor = ws;
  console.log('Using Neon database with WebSocket support');
}

// For development mode without database, use in-memory storage
if (process.env.NODE_ENV === 'development' && !process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgres://fake:fake@localhost:5432/fake';
  console.log('🧪 Using in-memory storage for development...');
} else if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Create a .env file based on .env.example",
  );
} else {
  console.log(`Database connection established to: ${process.env.DATABASE_URL.split('@')[1]}`);
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema });
