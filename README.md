# LiteLLM AWS Infrastructure

Production-ready deployment of LiteLLM proxy on AWS using CDK.

## Architecture

- **Network**: Multi-AZ VPC with public, private, and isolated subnets
- **Compute**: ECS Fargate running LiteLLM behind Application Load Balancer
- **Data**: RDS PostgreSQL (Multi-AZ in prod) and ElastiCache Redis
- **Edge**: CloudFront CDN with WAF protection
- **Monitoring**: CloudWatch dashboards and alarms

## Prerequisites

- AWS Account with appropriate permissions
- Node.js 18+ and npm
- AWS CLI configured
- CDK CLI (`npm install -g aws-cdk`)

## Deployment

```bash
# Install dependencies
npm install

# Bootstrap CDK (first time only)
cdk bootstrap

# Deploy all stacks
cdk deploy --all --context env=dev

# Or deploy individually
cdk deploy LiteLLM-Network-dev
cdk deploy LiteLLM-Data-dev
cdk deploy LiteLLM-Compute-dev
cdk deploy LiteLLM-Monitoring-dev
cdk deploy LiteLLM-Edge-dev
```

## Environments

- **dev**: Development environment with minimal resources
- **prod**: Production environment with HA and scaling

## CI/CD

GitHub Actions workflow automatically deploys to dev on push to main.
Production deployments require manual trigger.

## Access Points

After deployment, the application is accessible at:
- ALB: `http://<load-balancer-dns>/`
- CloudFront: `https://<distribution-id>.cloudfront.net/`

## Configuration

Environment-specific configs are in `config/dev.json` and `config/prod.json`.