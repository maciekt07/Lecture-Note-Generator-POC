#!/bin/bash


echo "Starting backend..."
cd server
python run.py &
SERVER_PID=$!
cd ..


echo "Starting frontend..."
cd client
npm run dev &


wait $SERVER_PID
