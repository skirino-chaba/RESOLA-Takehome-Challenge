# Deployment Issues and Fixes

## Issues Found

### 1. ✅ FIXED: Cyclic Dependencies Between Stacks
**Problem**: Security groups were being referenced across stacks creating circular dependencies.
**Solution**: Moved security group creation to the stack where they're used, allow connections from subnet CIDR blocks instead of specific security groups.

### 2. ✅ FIXED: S3 Lifecycle Policy Error  
**Problem**: Glacier transition days (90) must be at least 90 days more than Glacier_IR (30).
**Solution**: Changed Glacier transition to 180 days.

### 3. ✅ FIXED: S3 Bucket Name Conflicts
**Problem**: S3 bucket names must be globally unique. Using account ID caused conflicts when redeploying.
**Solution**: Use stack ID suffix instead of account ID for unique bucket names.

### 4. ✅ FIXED: Database Stack Deployment
**Problem**: Multiple issues:
- S3 bucket naming conflicts (fixed with timestamp suffix)
- PostgreSQL version not available (15.4, 15.5, 15, 14.9 all failed)
**Solution**: Use PostgreSQL VER_14 (defaults to latest 14.x available)

### 5. ❌ NOT STARTED: Docker Image Not in ECR
**Problem**: No Docker image built and pushed to ECR.
**Solution**: Need to:
```bash
# Build image
docker build -t litellm-proxy docker/

# Get ECR login
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 247829672091.dkr.ecr.us-east-1.amazonaws.com

# Tag and push
docker tag litellm-proxy:latest 247829672091.dkr.ecr.us-east-1.amazonaws.com/litellm-proxy-dev:latest
docker push 247829672091.dkr.ecr.us-east-1.amazonaws.com/litellm-proxy-dev:latest
```

### 6. ❌ NOT CONFIGURED: API Keys Missing
**Problem**: Placeholder API keys in Secrets Manager.
**Solution**: Update with real keys:
```bash
aws secretsmanager update-secret --secret-id APIKeysSecret \
  --secret-string '{"OPENAI_API_KEY":"sk-real-key","ANTHROPIC_API_KEY":"sk-ant-real-key","LITELLM_MASTER_KEY":"sk-master-key"}'
```

### 7. ❌ NOT TESTED: GitHub Actions
**Problem**: CI/CD pipeline not triggered/tested.
**Solution**: Need to add GitHub Secrets and test workflow.

## Current Deployment Status

| Stack | Status | Issues |
|-------|--------|--------|
| Network | ✅ DEPLOYED | None |
| Data | ❌ FAILED | S3 bucket conflict (fixed, redeploying) |
| Compute | ❌ NOT DEPLOYED | Waiting for Data stack |
| Monitoring | ❌ NOT DEPLOYED | Waiting for Compute stack |
| Edge | ❌ NOT DEPLOYED | Production only |

## Steps to Complete Deployment

1. **Wait for Data stack deletion** (5 min)
2. **Redeploy Data stack** with fixed S3 names (15 min)
3. **Deploy Compute stack** (10 min)
4. **Build and push Docker image** (5 min)
5. **Configure real API keys** (2 min)
6. **Deploy Monitoring stack** (5 min)
7. **Test the application** (10 min)

**Total time needed**: ~45-60 minutes

## Quick Fix Commands

```bash
# Delete failed stacks
aws cloudformation delete-stack --stack-name LiteLLM-Data-dev
aws cloudformation wait stack-delete-complete --stack-name LiteLLM-Data-dev

# Rebuild and deploy
cd litellm-aws-infra
npm run build
cdk deploy LiteLLM-Data-dev --context env=dev --require-approval never
cdk deploy LiteLLM-Compute-dev --context env=dev --require-approval never
cdk deploy LiteLLM-Monitoring-dev --context env=dev --require-approval never

# Test deployment
ALB_URL=$(aws cloudformation describe-stacks --stack-name LiteLLM-Compute-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerDNS`].OutputValue' --output text)
curl http://$ALB_URL/health
```

## Root Causes

1. **S3 Global Namespace**: Didn't account for S3's global unique naming requirement
2. **CDK Cross-Stack References**: Complex security group dependencies
3. **AWS Service Limits**: RDS creation time (10-15 min) makes debugging slow
4. **Missing Integration Tests**: No pre-deployment validation

## Lessons Learned

1. Use generated unique IDs for S3 buckets, not account IDs
2. Keep security groups in the same stack as resources using them
3. Test with smaller instance sizes first (faster deployment)
4. Add CDK unit tests to catch issues before deployment
5. Use `cdk diff` before deploying to preview changes