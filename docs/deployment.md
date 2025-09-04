# LiteLLM AWS Infrastructure Deployment Guide

## Prerequisites

1. **AWS Account**: Active AWS account with appropriate permissions
2. **AWS CLI**: Version 2.x installed and configured
3. **Node.js**: Version 18.x or later
4. **AWS CDK**: Version 2.x installed globally
5. **Docker**: For building container images

## Initial Setup

### 1. Clone the Repository
```bash
git clone https://github.com/skirino-chaba/RESOLA-Takehome-Challenge.git
cd litellm-aws-infra
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure AWS Credentials
```bash
aws configure
# Enter your AWS Access Key ID
# Enter your AWS Secret Access Key
# Default region: us-east-1
# Default output format: json
```

### 4. Bootstrap CDK
```bash
cdk bootstrap aws://ACCOUNT-ID/us-east-1
```

## Environment Configuration

### Development Environment
Edit `config/dev.json` to customize development settings:
```json
{
  "env": "dev",
  "region": "us-east-1",
  "vpc": {
    "maxAzs": 2,
    "natGateways": 1
  },
  "rds": {
    "instanceClass": "t3",
    "instanceSize": "small",
    "allocatedStorage": 20,
    "backupRetention": 3
  },
  "redis": {
    "nodeType": "cache.t3.micro",
    "numNodes": 1
  },
  "ecs": {
    "cpu": 512,
    "memory": 1024,
    "desiredCount": 1,
    "maxCount": 3
  }
}
```

### Production Environment
Edit `config/prod.json` for production settings.

## Deployment Steps

### 1. Build the Project
```bash
npm run build
```

### 2. Synthesize CloudFormation Templates
```bash
cdk synth --context env=dev
```

### 3. Deploy Infrastructure

#### Deploy All Stacks
```bash
cdk deploy --all --context env=dev
```

#### Deploy Individual Stacks
```bash
# Network Stack (VPC, Subnets, Security Groups)
cdk deploy LiteLLM-Network-dev --context env=dev

# Data Stack (RDS, ElastiCache, S3)
cdk deploy LiteLLM-Data-dev --context env=dev

# Compute Stack (ECS, ALB)
cdk deploy LiteLLM-Compute-dev --context env=dev

# Monitoring Stack (CloudWatch)
cdk deploy LiteLLM-Monitoring-dev --context env=dev
```

### 4. Configure Secrets

After deployment, update the API keys in AWS Secrets Manager:

```bash
# Update OpenAI API Key
aws secretsmanager update-secret \
  --secret-id APIKeysSecret \
  --secret-string '{"OPENAI_API_KEY":"sk-your-key-here"}'

# Update Anthropic API Key
aws secretsmanager update-secret \
  --secret-id APIKeysSecret \
  --secret-string '{"ANTHROPIC_API_KEY":"sk-ant-your-key-here"}'
```

### 5. Build and Push Docker Image

```bash
# Get ECR repository URL
ECR_REPO=$(aws ecr describe-repositories --repository-names litellm-proxy-dev --query 'repositories[0].repositoryUri' --output text)

# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $ECR_REPO

# Build and tag image
docker build -t $ECR_REPO:latest docker/

# Push image
docker push $ECR_REPO:latest

# Force ECS service update
aws ecs update-service \
  --cluster litellm-cluster-dev \
  --service litellm-service-dev \
  --force-new-deployment
```

## Verification

### 1. Check Stack Status
```bash
aws cloudformation describe-stacks \
  --stack-name LiteLLM-Compute-dev \
  --query 'Stacks[0].StackStatus'
```

### 2. Get Load Balancer URL
```bash
aws cloudformation describe-stacks \
  --stack-name LiteLLM-Compute-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerDNS`].OutputValue' \
  --output text
```

### 3. Test the API
```bash
# Health check
curl http://ALB-URL/health

# Test API with master key
curl -X POST http://ALB-URL/v1/chat/completions \
  -H "Authorization: Bearer sk-litellm-master-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

## CI/CD Pipeline

### GitHub Actions Setup

1. Add AWS credentials to GitHub Secrets:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`

2. Push to main branch triggers automatic deployment

### Manual Deployment
```bash
# Deploy to development
npm run deploy:dev

# Deploy to production
npm run deploy:prod
```

## Monitoring

### CloudWatch Dashboard
Access the dashboard at:
```
https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=litellm-dashboard-dev
```

### Key Metrics
- ECS CPU/Memory Utilization
- ALB Request Count and Latency
- RDS Connections and CPU
- Redis Hit Rate

### Alarms
Configure email notifications:
```bash
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:ACCOUNT-ID:LiteLLM-Alarms-dev \
  --protocol email \
  --notification-endpoint your-email@example.com
```

## Troubleshooting

### ECS Service Not Starting
```bash
# Check task logs
aws logs tail /ecs/litellm/dev --follow

# Describe service
aws ecs describe-services \
  --cluster litellm-cluster-dev \
  --services litellm-service-dev
```

### Database Connection Issues
```bash
# Check security groups
aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=*Database*"

# Test connection from bastion or local
psql -h RDS-ENDPOINT -U litellmadmin -d postgres
```

### High Costs
- Review CloudWatch Cost Explorer
- Consider using Fargate Spot for dev environment
- Implement S3 lifecycle policies
- Use reserved instances for production

## Cleanup

To destroy all resources:
```bash
# Remove all stacks
cdk destroy --all --context env=dev

# Or remove individual stacks in reverse order
cdk destroy LiteLLM-Monitoring-dev --context env=dev
cdk destroy LiteLLM-Compute-dev --context env=dev
cdk destroy LiteLLM-Data-dev --context env=dev
cdk destroy LiteLLM-Network-dev --context env=dev
```

## Security Best Practices

1. **Never commit secrets** to the repository
2. **Rotate API keys** regularly
3. **Use IAM roles** instead of access keys where possible
4. **Enable MFA** for AWS account
5. **Review security groups** periodically
6. **Monitor VPC Flow Logs** for suspicious activity
7. **Keep dependencies updated** with `npm audit`

## Support

For issues or questions:
- Check CloudWatch Logs
- Review the [Architecture Documentation](./architecture.md)
- Open an issue on GitHub