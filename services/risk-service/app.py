from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI(title="CardRail Risk Simulator", version="0.1.0")

class RiskRequest(BaseModel):
    amount: float = Field(gt=0)
    currency: str
    merchantId: str

@app.get("/health")
def health():
    return {"status": "UP", "service": "risk-service"}

@app.post("/evaluate")
def evaluate(request: RiskRequest):
    # Transparent deterministic rules for learning, not a real fraud model.
    score = 5
    reasons = ["baseline"]
    if request.amount >= 1000:
        score += 20
        reasons.append("high-value-synthetic-transaction")
    if request.amount >= 5000:
        score += 25
        reasons.append("very-high-value-synthetic-transaction")
    if request.merchantId.lower().startswith("risk-"):
        score += 70
        reasons.append("synthetic-risk-merchant-marker")
    decision = "DECLINE" if score >= 70 else "APPROVE"
    return {"decision": decision, "score": min(score, 100), "reason": ",".join(reasons)}
