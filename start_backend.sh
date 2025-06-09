#!/bin/bash
# Start the Argon backend server on port 7000

cd backend
export PORT=7000
python -m uvicorn main:app --host 0.0.0.0 --port 7000 --reload
