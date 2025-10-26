conda create -n skillbridge python=3.11 -y
conda activate skillbridge
pip install uv
uv pip install -r requirements.txt
uvicorn app.main:app --reload