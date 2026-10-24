@echo off
echo Starting PageSense AI FastAPI Backend on http://127.0.0.1:8000 ...
uvicorn main:app --reload --host 127.0.0.1 --port 8000
pause
