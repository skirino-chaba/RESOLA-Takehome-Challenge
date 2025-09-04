#!/usr/bin/env python3
"""Health check script for LiteLLM proxy."""

import requests
import sys

def check_health():
    """Check if LiteLLM proxy is healthy."""
    try:
        response = requests.get('http://localhost:8000/health', timeout=5)
        if response.status_code == 200:
            print("Health check passed")
            sys.exit(0)
        else:
            print(f"Health check failed with status: {response.status_code}")
            sys.exit(1)
    except Exception as e:
        print(f"Health check failed: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    check_health()