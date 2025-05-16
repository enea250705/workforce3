// CommonJS script to load environment variables and start the application
const { existsSync } = require('fs');
const { resolve } = require('path');
const { config } = require('dotenv');
const { spawn } = require('child_process');

// Set environment to production
process.env.NODE_ENV = 'production';

// Determine the correct path to the .env file
const envPath = resolve(process.cwd(), '.env');

// Load environment variables from .env file if it exists
if (existsSync(envPath)) {
  config({ path: envPath });
  console.log('🔧 Environment variables loaded from .env file');
} else {
  console.warn('⚠️ No .env file found. Using default or system environment variables.');
}

console.log(`Starting application in ${process.env.NODE_ENV} mode...`);

// Start the ESM application
const app = spawn('node', ['dist/index.js'], {
  stdio: 'inherit',
  env: process.env
});

app.on('close', (code) => {
  console.log(`Application exited with code ${code}`);
  process.exit(code);
});

// Handle termination signals
process.on('SIGINT', () => {
  console.log('Gracefully shutting down...');
  app.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('Gracefully shutting down...');
  app.kill('SIGTERM');
}); 