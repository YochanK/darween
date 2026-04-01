.PHONY: install server client dev stop test clean

# Install all dependencies
install:
	cd server && uv sync
	cd client && npm install

# Start the backend server
server:
	cd server && uv run uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Start the frontend dev server
client:
	cd client && npx vite --host

# Start both servers in parallel (Ctrl+C to stop)
dev: stop
	@echo "Starting server and client..."
	@trap 'kill 0' EXIT; \
	cd server && uv run uvicorn main:app --host 0.0.0.0 --port 8000 --reload & \
	cd client && npx vite --host & \
	wait

# Stop any running servers
stop:
	-pkill -f "uvicorn main:app" 2>/dev/null
	-pkill -f "vite" 2>/dev/null
	@echo "Servers stopped"

# Build the client for production
build:
	cd client && npx vite build

# Run Playwright tests
test:
	node test_creatures.js

# Remove generated files
clean:
	rm -rf server/.venv server/uv.lock
	rm -rf client/node_modules client/dist
	rm -rf node_modules
