// Simple wrapper script for Windows to set environment variables
// This is kept as a regular js file in dist folder for easy access

// Set production environment
process.env.NODE_ENV = "production";

// Load the database URL from the .env file
// This uses native node fs module rather than requiring packages
try {
  const fs = await import('fs');
  const path = await import('path');
  
  const envPath = path.resolve(process.cwd(), '.env');
  
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    const lines = content.split('\n');
    
    for (const line of lines) {
      // Skip empty lines and comments
      if (!line || line.startsWith('#')) continue;
      
      // Parse key=value pairs
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (!match) continue;
      
      const key = match[1];
      let value = match[2] || '';
      
      // Remove quotes if present
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      
      // Set environment variable
      process.env[key] = value;
    }
    
    console.log('🔧 Environment variables loaded from .env file');
  } else {
    console.warn('⚠️ No .env file found.');
  }
} catch (error) {
  console.error('Error loading environment variables:', error);
}

// Log startup info
console.log(`Starting Workforce Manager in ${process.env.NODE_ENV} mode...`);
console.log(`Database: ${process.env.DATABASE_URL ? 'Configured ✓' : 'Not configured ✗'}`);
console.log(`Port: ${process.env.PORT || 3000}`);

// Start the application
console.log('Starting application...');
import('./index.js')
  .then(() => console.log('Application started successfully!'))
  .catch(err => {
    console.error('Failed to start application:', err);
    process.exit(1);
  }); 