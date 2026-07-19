export VITE_API_URL=https://workersai.zwz.workers.dev/ # change to your own api url
cd frontend
pnpm format
pnpm build
cd ../backend
pnpm format
pnpm run deploy
