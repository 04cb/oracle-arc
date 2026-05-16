"""Centralized .env loading. Import this before any other oracle module."""

import os
from pathlib import Path

import certifi
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent.parent

load_dotenv(REPO_ROOT / ".env", override=True)
os.environ.setdefault("SSL_CERT_FILE", certifi.where())

ANTHROPIC_BASE_URL = os.environ["ANTHROPIC_BASE_URL"]
ANTHROPIC_AUTH_TOKEN = os.environ["ANTHROPIC_AUTH_TOKEN"]
ANTHROPIC_MODEL = os.environ["ANTHROPIC_MODEL"]
ARC_RPC_URL = os.environ.get("ARC_RPC_URL", "")
ARC_CHAIN_ID = int(os.environ.get("ARC_CHAIN_ID", "5042002"))
AGENT_PRIVATE_KEY = os.environ.get("AGENT_PRIVATE_KEY", "")
PICK_LEDGER_ADDRESS = os.environ.get("PICK_LEDGER_ADDRESS", "")
POLYMARKET_BUILDER_CODE = os.environ.get("POLYMARKET_BUILDER_CODE", "")
