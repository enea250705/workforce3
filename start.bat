@echo off
echo === Starting Workforce Manager ===

rem Set environment to production
set NODE_ENV=production

rem Check if .env file exists
if exist .env (
  echo Loading environment from .env file...
  for /F "tokens=*" %%A in (.env) do (
    set "%%A"
  )
) else (
  echo Warning: No .env file found. Using default environment.
)

echo Starting application...
node dist/index.js

pause 