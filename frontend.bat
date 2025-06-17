@echo off
REM Start the Argon frontend development server

echo Starting frontend development server...

cd frontend

echo Attempting to start development server...
npm run dev

if %errorlevel% neq 0 (
    echo Error starting development server. Checking npm installation...
    npm --version
    echo.
    echo Make sure you have Node.js and npm installed.
    echo You may need to run: npm install
)

pause