import os
import stripe
from fastapi import FastAPI
from openai import OpenAI

app = FastAPI()
stripe.api_key = os.environ["STRIPE_SECRET_KEY"]
client = OpenAI()
