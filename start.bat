@echo off
echo Starting T-Mobile AI Assistant...
echo.
echo Make sure Ollama is running with: ollama serve
echo And that you have pulled a model: ollama pull llama3.2:latest
echo.
echo Starting backend...
start cmd /k "cd backend && npm install && npm start"
timeout /t 3
echo Starting frontend...
start cmd /k "cd frontend && npm install && npm start"
echo.
echo Both services are starting...
echo Backend: http://localhost:5000
echo Frontend: http://localhost:3000