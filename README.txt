=============================================
WORKFORCE MANAGER - VPS DEPLOYMENT GUIDE
=============================================

This guide will help you deploy the Workforce Manager application on a VPS.

Prerequisites:
-------------
- Node.js 16+ 
- NPM
- PostgreSQL database (we're using Neon PostgreSQL)

DEPLOYMENT STEPS
----------------

1. SETUP DATABASE
   Your database URL is already configured:
   postgresql://neondb_owner:npg_ST1xy8lAVqLF@ep-cool-bar-a4i0caol-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require

2. INSTALLATION
   Run the following commands:
   
   npm install
   npm run build
   npx drizzle-kit push --force

3. STARTING THE APPLICATION (CHOOSE ONE METHOD)
   
   METHOD 1 (RECOMMENDED): 
   Run the batch file:
   .\start.bat
   
   METHOD 2:
   Set environment and run the app:
   set NODE_ENV=production
   node dist/index.js
   
   METHOD 3:
   npm run start:win

4. ACCESS THE APPLICATION
   Open a browser and navigate to:
   http://localhost:3000

5. DEFAULT LOGIN CREDENTIALS
   - Admin: username=admin, password=admin123
   - Employee: username=employee, password=employee123
   
   IMPORTANT: Change these passwords immediately after first login.

TROUBLESHOOTING
---------------
- If you get database errors, check the connection string in .env file
- If the application won't start, try running 'npm install dotenv' first
- For other issues, check the console output for error messages

PRODUCTION SETUP
---------------
For a production environment, consider:
1. Setting up a process manager like PM2:
   npm install -g pm2
   pm2 start .\start.bat --name "workforce-manager"

2. Configure a reverse proxy with Nginx (see nginx.conf.example)

3. Enable SSL for secure connections 