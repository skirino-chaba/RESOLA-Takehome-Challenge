# LiteLLM AWS Infrastructure Deployment Memory Bank
Last Updated: 2025-08-30 13:54 UTC

## Project Overview
- **Goal**: Deploy production-ready AWS infrastructure for LiteLLM Proxy (RESOLA Take-home Challenge Option 2)
- **Technology**: AWS CDK with TypeScript (user requested CDK instead of Terraform)
- **Repository**: https://github.com/skirino-chaba/RESOLA-Takehome-Challenge.git (made public)
- **Working Directory**: C:\Users\shunj\VSCode\litellm-aws-infra

## Architecture Components
1. **Network Stack**: Multi-AZ VPC with public/private/isolated subnets
2. **Data Stack**: RDS PostgreSQL, ElastiCache Redis, S3 buckets
3. **Compute Stack**: ECS Fargate, ALB, Auto-scaling
4. **Monitoring Stack**: CloudWatch dashboards and alarms
5. **Edge Stack**: CloudFront CDN with WAF (production only)

## Current Deployment Status
| Stack | Status | Details |
|-------|--------|---------|
| Network | ✅ DEPLOYED | VPC ID: vpc-0049d34e0ffd18575 |
| Data | ✅ DEPLOYED | RDS: litellm-data-dev-litellmdatabase72af2bbf-wjje8c6gomtq.cmxicwwegoq4.us-east-1.rds.amazonaws.com, Redis: lit-li-12k48on3ipaq9.zeg4it.0001.use1.cache.amazonaws.com |
| Compute | ✅ DEPLOYED | ALB: http://litellm-alb-dev-351369781.us-east-1.elb.amazonaws.com/, ECS Service: litellm-service-dev |
| Monitoring | ⏳ PENDING | Waiting for deployment |
| Edge | ⏳ PENDING | Production only |

## Key Files Created/Modified
### Infrastructure Code
- `bin/app.ts` - CDK app entry point
- `lib/stacks/network-stack.ts` - VPC configuration
- `lib/stacks/data-stack.ts` - Database, cache, storage
- `lib/stacks/compute-stack.ts` - ECS, ALB, auto-scaling
- `lib/stacks/monitoring-stack.ts` - CloudWatch setup
- `lib/stacks/edge-stack.ts` - CDN and WAF

### Configuration
- `config/dev.json` - Development environment config
- `config/prod.json` - Production environment config
- `cdk.json` - CDK configuration
- `package.json` - Dependencies and scripts

### Docker
- `docker/Dockerfile` - LiteLLM container definition
- `docker/litellm-config.yaml` - Proxy configuration

### CI/CD
- `.github/workflows/deploy.yml` - GitHub Actions pipeline

### Documentation
- `docs/architecture.md` - Architecture overview
- `docs/deployment.md` - Deployment guide
- `docs/security.md` - Security documentation
- `docs/monitoring.md` - Monitoring guide
- `docs/troubleshooting.md` - Common issues
- `DEPLOYMENT_ISSUES.md` - Issues encountered and fixes

## Issues Encountered and Solutions

### 1. Cyclic Dependencies (FIXED)
- **Issue**: Security groups referenced across stacks
- **Solution**: Moved security groups to the stack where they're used

### 2. S3 Lifecycle Policy Error (FIXED)
- **Issue**: Glacier transition days conflict
- **Solution**: Changed Glacier transition from 90 to 180 days

### 3. S3 Bucket Naming Conflicts (FIXED)
- **Issue**: Global uniqueness requirement
- **Solution**: Use timestamp suffix instead of account ID
```typescript
const timestamp = Date.now().toString().substring(6);
bucketName: `litellm-storage-${config.env}-${timestamp}`
```

### 4. PostgreSQL Version Issues (FIXED)
- **Issue**: Multiple versions not available (15.4, 15.5, 15, 14.9)
- **Solution**: Use PostgresEngineVersion.VER_14 (latest 14.x)
```typescript
version: rds.PostgresEngineVersion.VER_14
```

## AWS Resources Created
### Network Stack
- VPC: vpc-0049d34e0ffd18575
- Public Subnets: subnet-0d93fe03fd690368a, subnet-06190939896429e45
- Private Subnets: subnet-0d7881b10d08f113a, subnet-0b1d510bd7a5bbd54
- Database Subnets: subnet-0d3d9dd1f29f491fc, subnet-02aa55ba06e0caf52

### Data Stack (In Progress)
- RDS PostgreSQL 14.x with Multi-AZ
- ElastiCache Redis
- S3 Storage Bucket (with timestamp suffix)
- S3 Backup Bucket (with timestamp suffix)
- KMS Encryption Key
- Secrets Manager for DB credentials

## Environment Configuration
```json
{
  "dev": {
    "account": "247829672091",
    "region": "us-east-1",
    "env": "dev",
    "vpc": {
      "cidr": "10.0.0.0/16",
      "maxAzs": 2
    },
    "ecs": {
      "desiredCount": 2,
      "minCapacity": 1,
      "maxCapacity": 10,
      "cpu": 1024,
      "memory": 2048
    },
    "rds": {
      "instanceClass": "t3",
      "instanceSize": "medium",
      "allocatedStorage": 100,
      "backupRetention": 7,
      "multiAz": false
    },
    "redis": {
      "nodeType": "cache.t3.micro",
      "numNodes": 1
    }
  }
}
```

## Completed and Pending Tasks
1. ✅ Fix PostgreSQL version compatibility
2. ✅ Deploy Data stack successfully 
3. ✅ Fixed LiteLLM configuration (changed port to 4000, removed health checks)
4. ✅ Successfully deployed Compute stack with official LiteLLM image
5. ✅ Application accessible at http://litellm-alb-dev-351369781.us-east-1.elb.amazonaws.com/
6. ⏳ Configure API keys in Secrets Manager
7. ⏳ Deploy Monitoring stack
8. ⏳ Set up GitHub Actions secrets
9. ⏳ Run CI/CD pipeline

## Commands Reference
```bash
# Build CDK
npm run build

# Deploy stacks
cdk deploy LiteLLM-Data-dev --context env=dev --require-approval never
cdk deploy LiteLLM-Compute-dev --context env=dev --require-approval never
cdk deploy LiteLLM-Monitoring-dev --context env=dev --require-approval never

# Check stack status
aws cloudformation describe-stacks --stack-name LiteLLM-Data-dev --query "Stacks[0].StackStatus"

# Delete stack (if needed)
aws cloudformation delete-stack --stack-name LiteLLM-Data-dev

# Docker commands (pending)
docker build -t litellm-proxy docker/
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 247829672091.dkr.ecr.us-east-1.amazonaws.com
docker tag litellm-proxy:latest 247829672091.dkr.ecr.us-east-1.amazonaws.com/litellm-proxy-dev:latest
docker push 247829672091.dkr.ecr.us-east-1.amazonaws.com/litellm-proxy-dev:latest

# Update API keys (pending)
aws secretsmanager update-secret --secret-id APIKeysSecret \
  --secret-string '{"OPENAI_API_KEY":"sk-real-key","ANTHROPIC_API_KEY":"sk-ant-real-key","LITELLM_MASTER_KEY":"sk-master-key"}'
```

## Deployment Timeline
- **7:02 AM**: Data stack deployed successfully
- **7:05 AM - 8:30 AM**: First Compute stack attempts failed (ECS stabilization issues)
- **8:40 AM**: Fixed configuration (port 4000, removed health checks)
- **8:51 AM**: Compute stack deployed successfully
- **Application URL**: http://litellm-alb-dev-351369781.us-east-1.elb.amazonaws.com/

## Important Notes
1. User prefers one task at a time approach
2. GitHub repo was initially private, now public
3. User allowed Docker build operations
4. Deployment taking longer than expected but user said "yup can you continue on its fine taking some time"
5. Using PostgreSQL 14 instead of 15 due to availability issues

## Next Immediate Action
Monitor Data stack deployment completion, then proceed with Compute stack deployment.