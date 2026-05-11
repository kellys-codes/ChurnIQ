# ═══════════════════════════════════════════════════════════════
# server.py — ChurnIQ | Flask API for XGBoost Inference
# ═══════════════════════════════════════════════════════════════
import os
import math
import json
import numpy as np
import xgboost as xgb
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# ── Model Loading ─────────────────────────────────────────────
MODEL_PATH = os.environ.get(
    "CHURNIQ_MODEL_PATH",
    os.path.join(os.path.dirname(__file__), "..", "model.json"),
)

booster = None
base_score = 0.5

FEATURE_NAMES = [
    "Call  Failure",
    "Complains",
    "Charge  Amount",
    "Frequency of use",
    "Frequency of SMS",
    "Distinct Called Numbers",
    "Age Group",
    "Tariff Plan",
    "Minutes of Use",
]


def load_model():
    """Load the XGBoost booster once at startup."""
    global booster, base_score
    resolved = os.path.abspath(MODEL_PATH)
    print(f"[ChurnIQ] Loading model from {resolved}")
    booster = xgb.Booster()
    booster.load_model(resolved)

    # Parse base_score from the JSON metadata
    with open(resolved, "r") as f:
        meta = json.load(f)
    raw_bs = meta.get("learner", {}).get("learner_model_param", {}).get("base_score", "0.5")
    base_score = float(str(raw_bs).strip("[]"))
    print(f"[ChurnIQ] Model loaded — {booster.num_boosted_rounds()} trees, base_score={base_score}")


# ── Inference Helpers ─────────────────────────────────────────
def _erf(x: float) -> float:
    """Approximate error function (Abramowitz & Stegun)."""
    p = 0.3275911
    a = [0.254829592, -0.284496736, 1.421413741, -1.453152027, 1.061405429]
    sign = -1 if x < 0 else 1
    x = abs(x)
    t = 1.0 / (1.0 + p * x)
    y = 1.0 - (((((a[4] * t + a[3]) * t + a[2]) * t + a[1]) * t + a[0]) * t * math.exp(-x * x))
    return sign * y


def compute_risk_score(features: dict) -> int:
    """
    Run XGBoost prediction and return a 0-100 risk score.

    Features dict keys:
      call_failure, complains, charge_amount, frequency_of_use,
      frequency_of_sms, distinct_called_numbers, age_group,
      tariff_plan, seconds_of_use
    """
    call_failure = float(features.get("call_failure", 0))
    complains = float(features.get("complains", 0))
    charge_amount = float(features.get("charge_amount", 0))
    freq_use = float(features.get("frequency_of_use", 0))
    freq_sms = float(features.get("frequency_of_sms", 0))
    distinct = float(features.get("distinct_called_numbers", 0))
    age_group = float(features.get("age_group", 1))
    tariff_plan = float(features.get("tariff_plan", 1))
    seconds_of_use = float(features.get("seconds_of_use", 0))
    minutes_of_use = seconds_of_use / 60.0

    row = np.array(
        [[call_failure, complains, charge_amount, freq_use, freq_sms,
          distinct, age_group, tariff_plan, minutes_of_use]],
        dtype=np.float32,
    )
    dmat = xgb.DMatrix(row, feature_names=FEATURE_NAMES)

    # XGBoost survival:aft returns log(predicted survival time)
    log_time = float(booster.predict(dmat)[0])

    # AFT CDF — probability of churn within 36 months
    sigma = 1.0  # default distribution scale
    z = (math.log(36) - log_time) / sigma
    risk = 0.5 * (1.0 + _erf(z / math.sqrt(2)))

    # Calibration multipliers (match predict.js behaviour)
    if call_failure > 0:
        risk += call_failure * 0.03
    if complains > 0:
        risk += 0.35
    if minutes_of_use < 30 and freq_use < 5:
        risk = max(risk, 0.85)

    # Clamp to 1-99 then scale to 0-100
    final = min(max(risk, 0.01), 0.99)
    return min(max(round(final * 100), 0), 100)


# ── Routes ────────────────────────────────────────────────────
@app.route("/predict", methods=["POST"])
def predict_single():
    """Single customer prediction."""
    body = request.get_json(force=True)
    features = body.get("features")
    if not features:
        return jsonify({"error": "Missing 'features' in request body"}), 400
    try:
        score = compute_risk_score(features)
        return jsonify({"prediction": score})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/predict/batch", methods=["POST"])
def predict_batch():
    """Batch prediction for CSV import (many rows at once)."""
    body = request.get_json(force=True)
    rows = body.get("rows")
    if not rows or not isinstance(rows, list):
        return jsonify({"error": "Missing 'rows' array in request body"}), 400
    try:
        predictions = [compute_risk_score(r) for r in rows]
        return jsonify({"predictions": predictions})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "model_loaded": booster is not None})


# ── Startup ───────────────────────────────────────────────────
if __name__ == "__main__":
    load_model()
    port = int(os.environ.get("CHURNIQ_PORT", 5000))
    print(f"[ChurnIQ] API running on http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=False)
