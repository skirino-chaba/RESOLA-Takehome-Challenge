# Use specific version for reproducibility
FROM python:3.11-slim@sha256:ce81dc539f0dd1b60e72c1e0c9bceb3ccc3d68b4126cfecc7a826b84b955bcc3

# Add metadata
LABEL maintainer="LiteLLM Team"
LABEL description="LiteLLM Proxy Server"

WORKDIR /app

# Install system dependencies
# hadolint ignore=DL3008
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies with specific versions for security
RUN pip install --no-cache-dir --upgrade pip==24.0 && \
    pip install --no-cache-dir \
    'litellm[proxy,extra_proxy_features]==1.0.0' \
    psycopg2-binary==2.9.9 \
    redis==5.0.1 \
    boto3==1.34.0

# Copy configuration files if they exist (for local testing)
# In production, config is passed via environment variables
COPY litellm-config.yaml /app/config.yaml
COPY health_check.py /app/health_check.py

# Create non-root user
RUN useradd -m -u 1000 litellm && chown -R litellm:litellm /app
USER litellm

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python /app/health_check.py || exit 1

EXPOSE 8000

# Start LiteLLM proxy
CMD ["litellm", "--config", "/app/config.yaml", "--host", "0.0.0.0", "--port", "8000", "--num_workers", "4"]