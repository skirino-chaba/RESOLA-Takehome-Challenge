# LiteLLM AWS Infrastructure

AWS infrastructure for LiteLLM Proxy using AWS CDK

## Overview
Production-ready deployment of LiteLLM Proxy on AWS with:
- ECS Fargate for container orchestration
- RDS PostgreSQL for data persistence
- ElastiCache Redis for caching
- CloudFront CDN for global distribution
- Full monitoring and alerting

## Quick Start

### Prerequisites
- Node.js 18+
- AWS CLI configured
- Docker
- AWS CDK CLI

### Installation
```bash
npm install
```

### Deployment
```bash
npm run deploy
```

## Architecture
See [docs/architecture.md](docs/architecture.md) for detailed architecture documentation.

## License
Private