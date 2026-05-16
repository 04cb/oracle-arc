"""Sanity check: does DeepSeek work through the Anthropic SDK?

Run from brain/ with:  uv run python test_llm.py
"""

import os
import ssl
from pathlib import Path

import certifi
import httpx
from anthropic import Anthropic
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env", override=True)

os.environ.setdefault("SSL_CERT_FILE", certifi.where())

_http = httpx.Client(verify=certifi.where(), timeout=60.0)

client = Anthropic(
    base_url=os.environ["ANTHROPIC_BASE_URL"],
    api_key=os.environ["ANTHROPIC_AUTH_TOKEN"],
    http_client=_http,
)

resp = client.messages.create(
    model=os.environ["ANTHROPIC_MODEL"],
    max_tokens=200,
    messages=[
        {
            "role": "user",
            "content": (
                'Respond with EXACTLY this JSON (nothing else): '
                '{"alive": true, "model_self_id": "<the model name you believe you are>"}'
            ),
        }
    ],
)

for block in resp.content:
    if getattr(block, "type", None) == "text":
        print(block.text)
print(f"\nusage: in={resp.usage.input_tokens}, out={resp.usage.output_tokens}")
