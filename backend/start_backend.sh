#!/bin/bash
# Backend startup script for grad2career

# Activate conda environment
source ~/anaconda3/etc/profile.d/conda.sh
conda activate skillbridge

# Navigate to backend directory
cd "$(dirname "$0")"

# Start uvicorn server
echo "Starting backend server on http://localhost:8000"
echo "Press Ctrl+C to stop"
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

