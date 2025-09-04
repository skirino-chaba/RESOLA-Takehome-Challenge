# Pardus — LiteLLM on AWS (Production-lean)

**Goal (3–5 days)**: Deploy LiteLLM proxy on AWS with IaC, basic DevOps, and essential security/monitoring.

## Architecture (shipped)
- VPC (2 AZ), public+private subnets, NAT
- ALB (+ WAF basic rules) → ECS Fargate (LiteLLM)
- RDS PostgreSQL (single-AZ), ElastiCache Redis (1 node)
- S3 (versioned), CloudWatch logs/metrics/alarms
- Secrets Manager + Parameter Store

## Why this scope
The prompt calls for RDS + Redis + WAF + ALB + ECS. I kept each to a minimal, explainable configuration and documented what I’d add next rather than shipping a full platform.

## How to deploy
```bash
npm i
cdk bootstrap aws://<account>/<region>
cdk deploy Pardus-Network-dev
cdk deploy Pardus-Data-dev
cdk deploy Pardus-Compute-dev
cdk deploy Pardus-Security-dev

curl http://<ALB-DNS>/health# Additional configs
## ECS updates
