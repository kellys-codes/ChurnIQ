
import os
import math
from scipy.special import erf
import json
import numpy as np
import xgboost as xgb
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
load_dotenv()

app = Flask(__name__)
CORS(app)

# ~~ Model Loading ~~
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

local_model = os.path.join(BASE_DIR, "model.json")
parent_model = os.path.join(BASE_DIR, "..", "model.json")

MODEL_PATH = os.environ.get(
    "CHURNIQ_MODEL_PATH",
    local_model if os.path.exists(local_model) else parent_model,
)

booster = None
base_score = 0.5
sigma = 1.0

FEATURE_NAMES = [
    "Call Failure",
    "Complains",
    "Charge Amount",
    "Frequency of use",
    "Frequency of SMS",
    "Distinct Called Numbers",
    "Age Group",
    "Tariff Plan",
    "Minutes of Use",
]

def load_model():
    # Load the XGBoost booster once at startup
    global booster, base_score, sigma
    resolved = os.path.abspath(MODEL_PATH)
    print(f"[ChurnIQ] Loading model from {resolved}")
    booster = xgb.Booster()
    booster.load_model(resolved)

    print(f"[ChurnIQ] Booster feature names: {booster.feature_names}")
    booster.feature_names = None

    with open(resolved, "r") as f:
        meta = json.load(f)
    raw_bs = meta.get("learner", {}).get("learner_model_param", {}).get("base_score", "0.5")
    base_score = float(str(raw_bs).strip("[]"))
    sigma_str = meta.get("learner", {}).get("objective", {}).get("aft_loss_param", {}).get("aft_loss_distribution_scale", "1.0")
    sigma = float(sigma_str)
    print(f"[ChurnIQ] Model loaded — {booster.num_boosted_rounds()} trees, base_score={base_score}, sigma={sigma}")


# ~~ Inference Helpers ~~

def compute_risk_score(features: dict) -> int:
    call_failure   = float(features.get("call_failure", 0))
    complains      = float(features.get("complains", 0))
    charge_amount  = float(features.get("charge_amount", 0))
    freq_use       = float(features.get("frequency_of_use", 0))
    freq_sms       = float(features.get("frequency_of_sms", 0))
    distinct       = float(features.get("distinct_called_numbers", 0))
    age_group      = float(features.get("age_group", 1))
    tariff_plan    = float(features.get("tariff_plan", 1))
    minutes_of_use = float(features.get("minutes_of_use", 0))

    row = np.array(
        [[call_failure, complains, charge_amount, freq_use, freq_sms,
          distinct, age_group, tariff_plan, minutes_of_use]],
        dtype=np.float32,
    )
    dmat = xgb.DMatrix(row)
    predicted_time = max(float(booster.predict(dmat)[0]), 1e-9)

    z = (math.log(36) - math.log(predicted_time)) / sigma
    risk = 0.5 * (1.0 + erf(z / math.sqrt(2)))

    final = min(max(risk, 0.01), 0.99)
    return min(max(round(final * 100), 0), 100)


def compute_risk_scores_batch(rows: list) -> list:
    features_list = [
        [
            float(r.get("call_failure", 0)),
            float(r.get("complains", 0)),
            float(r.get("charge_amount", 0)),
            float(r.get("frequency_of_use", 0)),
            float(r.get("frequency_of_sms", 0)),
            float(r.get("distinct_called_numbers", 0)),
            float(r.get("age_group", 1)),
            float(r.get("tariff_plan", 1)),
            float(r.get("minutes_of_use", 0)),
        ]
        for r in rows
    ]

    row_arr = np.array(features_list, dtype=np.float32)
    dmat = xgb.DMatrix(row_arr)
    predicted_times = np.maximum(booster.predict(dmat), 1e-9)

    z = (math.log(36) - np.log(predicted_times)) / sigma
    risk = 0.5 * (1.0 + erf(z / math.sqrt(2)))

    final = np.clip(risk, 0.01, 0.99)
    scores = np.clip(np.round(final * 100), 0, 100).astype(int)
    return scores.tolist()


# ~~ Frontend Routes ~~
@app.route("/")
def serve_index():
    if os.path.exists(os.path.join(BASE_DIR, "index.html")):
        return send_from_directory(BASE_DIR, "index.html")
    return send_from_directory(os.path.join(BASE_DIR, "static"), "index.html")

@app.route("/<path:path>")
def serve_static_files(path):
    if os.path.exists(os.path.join(BASE_DIR, path)):
        return send_from_directory(BASE_DIR, path)
    static_dir = os.path.join(BASE_DIR, "static")

    if os.path.exists(os.path.join(static_dir, path)):
        return send_from_directory(static_dir, path)
    return jsonify({"error": f"File '{path}' not found"}), 404


# ~~ Prediction Routes ~~
@app.route("/predict", methods=["POST"])
def predict_single():
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
    body = request.get_json(force=True)
    rows = body.get("rows")
    if not rows or not isinstance(rows, list):
        return jsonify({"error": "Missing 'rows' array in request body"}), 400
    try:
        predictions = compute_risk_scores_batch(rows)
        return jsonify({"predictions": predictions})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/predict/survival", methods=["POST"])
def predict_survival():
    body = request.get_json(force=True)
    rows = body.get("rows")
    if not rows or not isinstance(rows, list):
        return jsonify({"error": "Missing 'rows' array in request body"}), 400
    if not rows:
        return jsonify({"survival_curve": []})
    try:
        features_list = []
        for r in rows:
            features_list.append([
                float(r.get("call_failure", 0)),
                float(r.get("complains", 0)),
                float(r.get("charge_amount", 0)),
                float(r.get("frequency_of_use", 0)),
                float(r.get("frequency_of_sms", 0)),
                float(r.get("distinct_called_numbers", 0)),
                float(r.get("age_group", 1)),
                float(r.get("tariff_plan", 1)),
                float(r.get("minutes_of_use", 0))
            ])

        row_arr = np.array(features_list, dtype=np.float32)
        dmat = xgb.DMatrix(row_arr)
        predicted_times = np.maximum(booster.predict(dmat), 1e-9)
        log_predicted = np.log(predicted_times)

        curve = []
        for month in range(49):
            if month == 0:
                curve.append(100.0)
                continue
            z = (math.log(month) - log_predicted) / sigma
            churn_prob = 0.5 * (1.0 + erf(z / math.sqrt(2)))
            surv = 1.0 - churn_prob
            surv = np.where(z < -5, 1.0, surv)
            surv = np.where(z > 5, 0.0, surv)
            avg_surv = float(np.mean(surv) * 100.0)
            curve.append(round(avg_surv, 2))

        return jsonify({"survival_curve": curve})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "model_loaded": booster is not None})


# ~~ Startup ~~
# Called at module level so Gunicorn / HuggingFace WSGI initialises correctly.
# (Inside __main__ only would be skipped by Gunicorn.)
load_model()

if __name__ == "__main__":
    port = int(os.environ.get("CHURNIQ_PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)

