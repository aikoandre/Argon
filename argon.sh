#!/bin/bash
# Start both Argon backend and frontend servers

echo "Starting Argon..."
echo "Backend will run on http://localhost:7000"
echo "Frontend will run on http://localhost:5173 (Vite default)"
echo ""

# Function to clean up background processes on exit
cleanup() {
    echo ""
    echo "Shutting down servers..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}

# Set up trap to call cleanup on script exit
trap cleanup EXIT INT TERM

# Start backend in background
echo "Starting backend server..."
cd backend
export PORT=7000
python -m uvicorn main:app --host 0.0.0.0 --port 7000 --reload &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 2

# Start frontend in background
echo "Starting frontend server..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "Both servers started!"
echo "Backend: http://localhost:7000"
echo "Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait for either process to exit
wait
