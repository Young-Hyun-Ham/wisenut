# chatbot-admin-backend (skeleton)

## 개요
- Design-first 스켈레톤
- OpenAPI: `openapi.yaml`

## 실행
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8100
```
