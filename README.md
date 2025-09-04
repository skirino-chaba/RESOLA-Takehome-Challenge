# LiteLLM AWS Infrastructure

Production-ready AWS infrastructure for LiteLLM Proxy - a unified API gateway for multiple LLM providers.

## Overview

This project implements a complete AWS infrastructure for deploying LiteLLM Proxy using AWS CDK (Cloud Development Kit) with TypeScript. The infrastructure is designed for high availability, scalability, and security following AWS Well-Architected Framework principles.

### Key Features
- **High Availability**: Multi-AZ deployment across all layers
- **Auto-scaling**: Automatic scaling based on load (2-6 containers)
- **Security**: End-to-end encryption, IAM roles, WAF protection
- **Monitoring**: Complete observability with CloudWatch
- **CI/CD**: Automated deployment with GitHub Actions
- **Cost Optimized**: Efficient resource usage with auto-scaling

## Architecture

```
Internet → CloudFront CDN → WAF → ALB → ECS Fargate → RDS/Redis
                                    ↓
                            CloudWatch Monitoring
```

### Components
- **Compute**: ECS Fargate with auto-scaling
- **Database**: RDS PostgreSQL (Multi-AZ) for user management
- **Cache**: ElastiCache Redis for response caching
- **Storage**: S3 for file storage and backups
- **CDN**: CloudFront for global distribution
- **Security**: WAF, Security Groups, IAM roles, KMS encryption
- **Monitoring**: CloudWatch dashboards, metrics, and alarms

## Quick Start

### Prerequisites
- AWS Account with appropriate permissions
- Node.js 18+ and npm
- AWS CLI configured
- AWS CDK CLI (`npm install -g aws-cdk`)
- Docker (for building images)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/skirino-chaba/RESOLA-Takehome-Challenge.git
cd litellm-aws-infra
```

2. Install dependencies:
```bash
npm install
```

3. Bootstrap CDK:
```bash
cdk bootstrap aws://YOUR-ACCOUNT-ID/us-east-1
```

### Deployment

#### Deploy to Development
```bash
npm run deploy:dev
```

#### Deploy to Production
```bash
npm run deploy:prod
```

#### Deploy Individual Stacks
```bash
# Network infrastructure
cdk deploy LiteLLM-Network-dev --context env=dev

# Data layer (RDS, Redis, S3)
cdk deploy LiteLLM-Data-dev --context env=dev

# Compute layer (ECS, ALB)
cdk deploy LiteLLM-Compute-dev --context env=dev

# Monitoring
cdk deploy LiteLLM-Monitoring-dev --context env=dev
```

## Configuration

### Environment Variables
Create a `.env` file based on `.env.example`:
```env
OPENAI_API_KEY=sk-xxx
ANTHROPIC_API_KEY=sk-ant-xxx
LITELLM_MASTER_KEY=sk-litellm-xxx
```

### Stack Configuration
- **Development**: `config/dev.json`
- **Production**: `config/prod.json`

## Project Structure

```
litellm-aws-infra/
├── bin/              # CDK app entry point
├── lib/
│   ├── stacks/       # CDK stack definitions
│   └── constructs/   # Reusable constructs
├── docker/           # Docker configuration
├── config/           # Environment configurations
├── .github/          # GitHub Actions workflows
├── docs/             # Documentation
└── scripts/          # Helper scripts
```

## Monitoring & Operations

### Access CloudWatch Dashboard
```bash
aws cloudformation describe-stacks \
  --stack-name LiteLLM-Monitoring-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`DashboardURL`].OutputValue' \
  --output text
```

### Get Load Balancer URL
```bash
aws cloudformation describe-stacks \
  --stack-name LiteLLM-Compute-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerDNS`].OutputValue' \
  --output text
```

### Test the API
```bash
curl http://ALB-URL/health
```

## CI/CD Pipeline

The project includes GitHub Actions workflows for:
- **Continuous Integration**: Testing and validation on every push
- **Continuous Deployment**: Automatic deployment to dev on merge to main
- **Security Scanning**: Container vulnerability scanning with Trivy
- **Infrastructure Validation**: CDK synth and CloudFormation validation

### Required GitHub Secrets
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

## Cost Estimation

### Development Environment
- **Monthly Cost**: ~$150-200
- ECS Fargate: ~$30
- RDS (t3.small): ~$25
- ElastiCache: ~$15
- ALB: ~$25
- Storage & Network: ~$20

### Production Environment
- **Monthly Cost**: ~$400-600
- ECS Fargate: ~$100
- RDS (t3.medium, Multi-AZ): ~$120
- ElastiCache: ~$50
- CloudFront: ~$50
- ALB: ~$25
- Storage & Network: ~$50

## Security Considerations

- **Encryption**: All data encrypted at rest and in transit
- **IAM Roles**: Least privilege access control
- **Security Groups**: Restrictive network access
- **Secrets Management**: AWS Secrets Manager for API keys
- **WAF**: Protection against common web exploits
- **VPC**: Network isolation with private subnets

## Troubleshooting

See [docs/deployment.md](docs/deployment.md) for detailed troubleshooting guide.

## Documentation

- [Architecture Overview](docs/architecture.md)
- [Deployment Guide](docs/deployment.md)
- [Operations Manual](docs/operations.md)

## Cleanup

To destroy all resources:
```bash
cdk destroy --all --context env=dev
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit changes
4. Push to the branch
5. Create a Pull Request

## License

Private - All rights reserved

## Support

For issues or questions, please open an issue on GitHub.

---

Built with AWS CDK and TypeScript for reliable cloud infrastructure.

## Deployment Status

- ✅ All stacks deployed successfully
- ✅ GitHub Actions configured
- ✅ Application live and running