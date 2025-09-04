# LiteLLM AWS Infrastructure - Testing Checklist

## Infrastructure Deployment Status

### ✅ Network Stack
- [x] VPC created with 2 AZs
- [x] Public/Private/Database subnets configured
- [x] NAT Gateway deployed
- [x] VPC Endpoints created
- [x] Security groups defined
- **Status**: DEPLOYED & TESTED

### ⏳ Data Stack (In Progress)
- [ ] RDS PostgreSQL Multi-AZ
- [ ] ElastiCache Redis
- [ ] S3 Storage bucket
- [ ] S3 Backup bucket
- [ ] KMS encryption keys
- [ ] Secrets Manager
- **Status**: DEPLOYING (Fixed S3 lifecycle issue)

### ❌ Compute Stack (Not Deployed)
- [ ] ECS Fargate cluster
- [ ] Task definitions
- [ ] ECS service with auto-scaling
- [ ] Application Load Balancer
- [ ] Target groups & health checks
- [ ] ECR repository
- **Status**: PENDING

### ❌ Monitoring Stack (Not Deployed)
- [ ] CloudWatch dashboards
- [ ] Alarms configured
- [ ] SNS topics
- [ ] Log groups
- **Status**: PENDING

### ❌ Edge Stack (Not Deployed - Prod Only)
- [ ] CloudFront distribution
- [ ] WAF rules
- [ ] Route53 (if domain available)
- **Status**: NOT REQUIRED FOR DEV

## Application Testing

### Docker Image
- [ ] Dockerfile builds successfully
- [ ] Health check endpoint works
- [ ] LiteLLM config valid
- [ ] Image pushed to ECR

### API Functionality
- [ ] Health check endpoint responds
- [ ] OpenAI integration works
- [ ] Anthropic integration works
- [ ] Rate limiting functions
- [ ] Database connection established
- [ ] Redis caching works

### Security Testing
- [ ] API keys stored in Secrets Manager
- [ ] No hardcoded credentials
- [ ] Security groups properly restrictive
- [ ] Encryption verified (in-transit and at-rest)
- [ ] IAM roles follow least privilege

### Performance Testing
- [ ] Auto-scaling triggers on load
- [ ] Response time < 100ms
- [ ] Database connection pooling works
- [ ] Redis cache hit rate acceptable

### CI/CD Pipeline
- [ ] GitHub Actions workflow triggers
- [ ] Build process completes
- [ ] CDK synth passes
- [ ] Security scanning with Trivy
- [ ] Deployment to dev works
- [ ] ECS service updates successfully

## Test Commands

### 1. Verify Stack Deployment
```bash
# Check all stacks
aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE

# Get stack outputs
aws cloudformation describe-stacks --stack-name LiteLLM-Network-dev
aws cloudformation describe-stacks --stack-name LiteLLM-Data-dev
aws cloudformation describe-stacks --stack-name LiteLLM-Compute-dev
```

### 2. Test Database Connectivity
```bash
# Get RDS endpoint
aws rds describe-db-instances --db-instance-identifier litellmdatabase

# Test connection (from bastion or EC2)
psql -h <rds-endpoint> -U litellmadmin -d postgres
```

### 3. Test Redis
```bash
# Get Redis endpoint
aws elasticache describe-cache-clusters --cache-cluster-id litellm-redis

# Test connection
redis-cli -h <redis-endpoint> ping
```

### 4. Test ECS Service
```bash
# List services
aws ecs list-services --cluster litellm-cluster-dev

# Describe service
aws ecs describe-services --cluster litellm-cluster-dev --services litellm-service-dev

# View logs
aws logs tail /ecs/litellm/dev --follow
```

### 5. Test Load Balancer
```bash
# Get ALB DNS
ALB_DNS=$(aws cloudformation describe-stacks --stack-name LiteLLM-Compute-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerDNS`].OutputValue' --output text)

# Test health endpoint
curl http://$ALB_DNS/health

# Test API
curl -X POST http://$ALB_DNS/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-3.5-turbo", "messages": [{"role": "user", "content": "Hello"}]}'
```

### 6. Test Auto-scaling
```bash
# Generate load
for i in {1..100}; do
  curl -X POST http://$ALB_DNS/v1/chat/completions \
    -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
    -H "Content-Type: application/json" \
    -d '{"model": "gpt-3.5-turbo", "messages": [{"role": "user", "content": "Test"}]}' &
done

# Monitor scaling
aws ecs describe-services --cluster litellm-cluster-dev --services litellm-service-dev \
  --query 'services[0].runningCount'
```

## Missing Requirements to Address

### High Priority (Must Have)
1. **Deploy Data Stack**: RDS, Redis, S3 (currently deploying)
2. **Deploy Compute Stack**: ECS, ALB
3. **Build & Push Docker Image**: To ECR
4. **Configure Secrets**: Add actual API keys
5. **Test Basic Functionality**: Health checks

### Medium Priority (Should Have)
6. **Deploy Monitoring Stack**: CloudWatch dashboards
7. **Test Auto-scaling**: Verify scaling policies work
8. **Run CI/CD Pipeline**: Test GitHub Actions
9. **Security Validation**: Check all security controls

### Low Priority (Nice to Have)
10. **Performance Testing**: Load testing
11. **Cost Analysis**: Verify cost estimates
12. **Documentation Review**: Ensure accuracy

## Current Blockers

1. **Data Stack Deployment**: In progress (10-15 min for RDS)
2. **API Keys**: Need actual OpenAI/Anthropic keys for testing
3. **Docker Image**: Needs to be built and pushed to ECR
4. **Full End-to-End Test**: Requires all stacks deployed

## Next Steps

1. Wait for Data Stack deployment to complete
2. Deploy Compute Stack
3. Build and push Docker image
4. Configure API keys in Secrets Manager
5. Test health endpoint
6. Deploy Monitoring Stack
7. Run full integration tests
8. Validate auto-scaling
9. Test CI/CD pipeline

## Time Estimate

- Data Stack: 15 minutes (deploying)
- Compute Stack: 10 minutes
- Docker Build/Push: 5 minutes
- Testing: 30-60 minutes
- **Total**: ~1-2 hours for full deployment and testing