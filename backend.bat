@echo off
REM Start the Argon backend server on port 7000

echo Starting backend server...

cd backend
set PORT=7000
set DATABASE_URL=sqlite:///../are_database.db

echo Attempting to start uvicorn server...
python -m uvicorn main:app --host 0.0.0.0 --port 7000 --reload

if %errorlevel% neq 0 (
    echo Error starting server. Checking Python installation...
    python --version
    echo.
    echo Make sure you have Python and the required packages installed.
    echo You may need to run: pip install fastapi uvicorn
)

pause