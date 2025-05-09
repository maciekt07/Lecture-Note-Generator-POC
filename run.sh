#!/bin/bash


echo "Starting backend..."
cd server
uvicorn server:app --reload &
SERVER_PID=$!
cd ..


echo "Starting frontend..."
cd client
npm run dev &


wait $SERVER_PID
