#!/bin/bash
export NVM_DIR="$HOME/.nvm"
source "$NVM_DIR/nvm.sh"

# Start infrastructure
docker-compose up -d

# Start Backend
cd backend
nvm use 20
npm install
npm run build
npm run start &
BACKEND_PID=$!

# Start Frontend
cd ../frontend
nvm use 20
npm install
npm start &
FRONTEND_PID=$!

echo "🚀 UserBot Manager started!"
echo "Backend: http://localhost:3000"
echo "Frontend: http://localhost:4200"
echo "Press Ctrl+C to stop"

trap "kill $BACKEND_PID $FRONTEND_PID; docker-compose stop; exit" INT TERM
wait
