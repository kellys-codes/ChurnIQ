from webapp.server import app, load_model

# Load the model when the serverless function cold-starts
load_model()