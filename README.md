# 📈 ChurnIQ

A web app that predicts which telecom customers are likely to cancel their subscription (churn), so a business can reach out to them before they leave. Uses a machine learning model trained on real customer usage data (call failures, complaints, usage patterns, billing, etc.) to estimate how likely each customer is to churn, and shows that information through a simple dashboard.

## 🔗 Links to Demo

- **Video**: https://drive.google.com/file/d/1aYjKM1K-v0pltn5_nAKEWBIkajtgjmWD/view?usp=sharing
- **Live app**: https://churniqsystem-01bd8.containers.snapdeploy.app (may take a few minutes to load)

## 💁 My Role
ML Engineer: Survival-analysis modeling (XGBoost AFT), feature engineering, model design, and evaluation. Also contributed to small parts of the web app.

## 📚 Tech stack

- **Backend:** Python, Flask, XGBoost
- **Frontend:** Plain HTML, CSS, and JavaScript (no framework), with Chart.js for the dashboard charts
- **Model training:** Jupyter notebooks, pandas, scikit-learn / scikit-survival

## 🚀 Features

- **Dashboard:** Overview charts and key stats across all uploaded customers
- **At-Risk Customers:** A filterable list of customers, sorted by churn risk 
- **Customer Segments:** Customers automatically grouped into the categories above 
- **Predict Customer:** Manually enter one customer's details to get an instant risk prediction 

## 🧱Architecture

Here's the journey a customer's data takes through ChurnIQ, from upload to insight:

1. **In the browser:** you either fill out one customer on the Predict page, or drop in a CSV. Either way, the plain JS frontend normalizes the data into a consistent shape before it goes anywhere.

2. **Over to Flask:** that data hits the API, which loads the trained XGBoost survival model once at startup and keeps it in memory for fast inference.

3. **The model does its thing:** instead of a flat yes/no, it predicts *how many months* a customer is likely to stay subscribed. The API converts that into a churn probability for a given time window (e.g. "chance of leaving within 36 months"), which becomes the 0–100% risk score.

4. **Back to the browser:** the score comes back with a risk label (LOW/MEDIUM/HIGH). From there, the frontend layers on the extra logic: predicted churn window, suggested next action, and automatic segmenting (high-risk, silent churners, upsell candidates, loyal customers, etc.). All rule-based, sitting on top of the model's output rather than inside it.

5. **Sticking around:** results are cached in the browser (localStorage) so the Dashboard, At-Risk, and Segments pages all stay in sync without re-uploading anything.

Training happens completely offline and separately from all of this. The notebooks produce `model.json`, and the API just loads whatever's sitting in that file.

## ⚙️ The model

The prediction engine is an **XGBoost survival model** (specifically an AFT (Accelerated Failure Time) model). Instead of just guessing "yes/no" on churn, it estimates *how long* a customer is likely to stay subscribed, and that estimate is converted into a churn probability for a given time window.

It was trained on a telecom customer dataset using features like:
- Number of dropped/failed calls
- Whether the customer has filed a complaint
- Billing amount
- Voice/SMS usage
- Number of unique contacts called
- Age group and tariff plan

The training and evaluation process (data cleaning, exploratory analysis, and model tuning) is documented in the Jupyter notebooks in the project root (`cleaning.ipynb`, `EDA.ipynb`, `baseline.ipynb`, `improvement_plan.ipynb`).

## Running it locally

You need two things running at the same time: the backend (the API that runs the model) and the frontend (the web pages).

**1. Backend**

```bash
cd webapp
pip install flask flask-cors xgboost numpy python-dotenv scipy
python3 server.py
```

This starts the API on `http://localhost:5000`.

**2. Frontend**

In a separate terminal:

```bash
cd webapp
python3 -m http.server 8080
```

Then open `http://localhost:8080/index.html` in your browser. The frontend automatically connects to the backend running on `localhost:5000`.

## Project structure

```
Churn-Analysis/
├── webapp/              # The actual web app (Flask backend + HTML/JS frontend)
│   ├── server.py        # API that loads the model and serves predictions
│   ├── index.html/.js   # Dashboard page
│   ├── atrisk.html/.js  # At-Risk Customers page
│   ├── segments.html/.js# Customer Segments page
│   ├── predict.html/.js # Predict Customer page
│   └── common.js        # Shared code (API calls, CSV upload, etc.)
├── dataset/              # Training/validation/test data
├── model.json            # The trained XGBoost model
├── EDA.ipynb              # Exploratory data analysis
├── cleaning.ipynb         # Data cleaning steps
├── baseline.ipynb         # First model attempt
└── improvement_plan.ipynb # Final model training and evaluation
```
