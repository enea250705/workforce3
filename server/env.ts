import { existsSync } from 'fs';
import { resolve } from 'path';
import { config } from 'dotenv';

// Determine the correct path to the .env file
const envPath = resolve(process.cwd(), '.env');

// Load environment variables from .env file if it exists
if (existsSync(envPath)) {
  config({ path: envPath });
  console.log('🔧 Environment variables loaded from .env file');
} else {
  console.warn('⚠️ No .env file found. Using default or system environment variables.');
}

// Validate essential environment variables
const requiredEnvVars = ['NODE_ENV'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.warn(`⚠️ Missing required environment variables: ${missingVars.join(', ')}`);
  
  // Set defaults for missing variables
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'development';
    console.log('🔧 NODE_ENV set to default: development');
  }
}

// Export a function to get environment variables with fallbacks
export function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue === undefined) {
      throw new Error(`Environment variable ${key} is required but not set`);
    }
    return defaultValue;
  }
  return value;
} 