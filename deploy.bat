@echo off
echo === Workforce Manager VPS Deployment Script (Windows) ===

rem Check if .env file exists, if not create from example
if not exist .env (
  echo Creating .env file from template...
  if exist .env.example (
    copy .env.example .env
    echo Created .env file. Please edit with your configuration values.
    echo Edit the file using: notepad .env
  ) else (
    echo Error: .env.example file not found!
    exit /b 1
  )
)

rem Install dependencies
echo Installing dependencies...
call npm install

rem Build the application
echo Building application...
call npm run build

echo Deployment completed!
echo Start the application with: npm run start:win
pause 