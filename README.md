# 📈 ChurnIQ

A web app that predicts which telecom customers are likely to cancel their subscription (churn), so a business can reach out to them before they leave. Uses a machine learning model trained on real customer usage data (call failures, complaints, usage patterns, billing, etc.) to estimate how likely each customer is to churn, and shows that information through a simple dashboard.

## 💁 My Role
ML Engineer: Survival-analysis modeling (XGBoost AFT), feature engineering, model design, and evaluation. Also contributed to small parts of the web app.

## 📚 Tech stack

- **Backend:** Python, Flask, XGBoost, MongoDB (for storing uploaded customer data)
- **Frontend:** Plain HTML, CSS, and JavaScript (no framework), with Chart.js for the dashboard charts
- **Model training:** Jupyter notebooks, pandas, scikit-learn / scikit-survival

## 🚀 Features

- **Dashboard:** Overview charts and key stats across all uploaded customers
- **At-Risk Customers:** A filterable list of customers, sorted by churn risk 
- **Customer Segments:** Customers automatically grouped into the categories above 
- **Predict Customer:** Manually enter one customer's details to get an instant risk prediction 

## What it does

- **Predicts churn risk** for a single customer by filling out a form, or for a whole list of customers at once by uploading a CSV file.
- **Scores every customer** as LOW, MEDIUM, or HIGH risk, along with a churn probability percentage.
- **Estimates when** a high-risk customer is likely to churn (e.g. within the next few months).
- **Suggests next steps**, like "escalate this complaint" or "schedule a retention call."
- **Groups customers into segments** automatically, such as:
  - High-risk customers
  - Low-engagement customers
  - Pay-as-you-go customers who could be upsold to a contract
  - Loyal, long-term customers
  - New subscribers
  - "Silent churners": customers who left without ever filing a complaint
- **Visualizes everything** on a dashboard with charts (churn rate over time, revenue at risk, customer breakdowns, etc.).

## How it works

1. You either fill in one customer's details on the **Predict Customer** page, or upload a CSV of many customers.
2. The customer data is sent to a backend API, which runs it through a trained machine learning model.
3. The model returns a churn risk score (0–100%) for each customer.
4. That score is turned into a risk label (LOW / MEDIUM / HIGH), a predicted churn window, and a suggested action.
5. If you uploaded a CSV, the results are saved to a database so they show up on the Dashboard, At-Risk, and Segments pages.

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
pip install flask flask-cors pymongo xgboost numpy python-dotenv scipy
python3 server.py
```

This starts the API on `http://localhost:5000`. MongoDB is optional — without it, single-customer predictions still work, you just can't save CSV-uploaded data between sessions.

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
