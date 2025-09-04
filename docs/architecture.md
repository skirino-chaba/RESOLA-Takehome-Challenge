# LiteLLM Proxy AWS Infrastructure Architecture

## Overview
This document describes the architecture of the LiteLLM Proxy deployed on AWS using CDK (Cloud Development Kit).

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                            Internet                              │
└────────────┬──────────────────────────────────┬──────────────────┘
             │                                  │
             ▼                                  ▼
┌──────────────────────┐          ┌──────────────────────┐
│   CloudFront CDN     │          │    Route53 DNS       │
│  (Global Distribution)│          │  (DNS Management)    │
└──────────┬───────────┘          └──────────────────────┘
           │
           ▼
┌──────────────────────┐
│     AWS WAF          │
│  (DDoS Protection)   │
└──────────┬───────────┘
           │
┌──────────┼───────────────────────────────────────────────────────┐
│          ▼                   AWS Cloud (us-east-1)               │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │                         VPC (10.0.0.0/16)                    │ │
│ │                                                               │ │
│ │  ┌──────────────────────────────────────────────────────┐   │ │
│ │  │              Public Subnets (Multi-AZ)                │   │ │
│ │  │                                                        │   │ │
│ │  │  ┌────────────────┐      ┌────────────────┐          │   │ │
│ │  │  │      ALB        │      │   NAT Gateway  │          │   │ │
│ │  │  │  (Load Balancer)│      │                │          │   │ │
│ │  │  └────────┬────────┘      └────────┬───────┘          │   │ │
│ │  └───────────┼─────────────────────────┼──────────────────┘   │ │
│ │              │                         │                       │ │
│ │  ┌───────────▼─────────────────────────▼──────────────────┐   │ │
│ │  │            Private Subnets (Multi-AZ)                  │   │ │
│ │  │                                                         │   │ │
│ │  │  ┌─────────────────────────────────────────────┐      │   │ │
│ │  │  │         ECS Fargate Cluster                 │      │   │ │
│ │  │  │  ┌─────────────┐  ┌─────────────┐         │      │   │ │
│ │  │  │  │  LiteLLM     │  │  LiteLLM     │         │      │   │ │
│ │  │  │  │  Container 1 │  │  Container 2 │         │      │   │ │
│ │  │  │  └─────────────┘  └─────────────┘         │      │   │ │
│ │  │  │         (Auto-scaling: 2-6 tasks)          │      │   │ │
│ │  │  └─────────────────────────────────────────────┘      │   │ │
│ │  └─────────────────────────────────────────────────────────┘   │ │
│ │                                                               │ │
│ │  ┌──────────────────────────────────────────────────────┐   │ │
│ │  │           Database Subnets (Multi-AZ)                │   │ │
│ │  │                                                        │   │ │
│ │  │  ┌──────────────┐        ┌──────────────┐           │   │ │
│ │  │  │   RDS        │        │  ElastiCache │           │   │ │
│ │  │  │ PostgreSQL   │        │    Redis     │           │   │ │
│ │  │  └──────────────┘        └──────────────┘           │   │ │
│ │  └────────────────────────────────────────────────────────┘   │ │
│ └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │                    Supporting Services                      │ │
│ │                                                              │ │
│ │  ┌─────────┐  ┌─────────┐  ┌──────────┐  ┌────────────┐  │ │
│ │  │   S3    │  │  Secrets│  │CloudWatch│  │    KMS     │  │ │
│ │  │ Storage │  │ Manager │  │  Logs    │  │ Encryption │  │ │
│ │  └─────────┘  └─────────┘  └──────────┘  └────────────┘  │ │
│ └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### Network Layer
- **VPC**: Multi-AZ VPC with public, private, and database subnets
- **NAT Gateways**: For outbound internet access from private subnets
- **VPC Endpoints**: For AWS service access without internet gateway

### Compute Layer
- **ECS Fargate**: Serverless container orchestration
- **Application Load Balancer**: Traffic distribution and health checks
- **Auto-scaling**: Scales from 2 to 6 containers based on load

### Data Layer
- **RDS PostgreSQL**: Multi-AZ database for high availability
- **ElastiCache Redis**: In-memory caching for performance
- **S3**: Object storage for files and backups

### Security
- **IAM Roles**: Least privilege access control
- **Security Groups**: Network-level security
- **KMS**: Encryption at rest for databases and S3
- **Secrets Manager**: Secure storage of API keys
- **WAF**: Web application firewall for API protection

### Monitoring
- **CloudWatch**: Metrics, logs, and dashboards
- **Alarms**: Automated alerting for critical issues
- **Container Insights**: Deep visibility into ECS performance

## High Availability

1. **Multi-AZ Deployment**: All critical components span multiple availability zones
2. **Auto-scaling**: Automatic scaling based on CPU/memory metrics
3. **Health Checks**: ALB performs regular health checks on containers
4. **Database Failover**: RDS Multi-AZ provides automatic failover

## Security Best Practices

1. **Network Isolation**: Private subnets for compute and data layers
2. **Encryption**: TLS in transit, KMS encryption at rest
3. **Secrets Management**: No hardcoded credentials
4. **IAM Roles**: Service-specific roles with minimal permissions
5. **VPC Flow Logs**: Network traffic monitoring
6. **Security Groups**: Restrictive ingress rules

## Scalability

- **Horizontal Scaling**: ECS Fargate auto-scaling (2-6 tasks)
- **Vertical Scaling**: Easy instance type changes via configuration
- **CDN**: CloudFront for global content delivery
- **Caching**: Redis for response caching

## Cost Optimization

1. **Fargate Spot**: Use spot instances for cost savings (dev environment)
2. **S3 Lifecycle**: Automatic archival of old data
3. **Reserved Instances**: For production RDS
4. **VPC Endpoints**: Reduce NAT Gateway costs

## Disaster Recovery

- **RDS Backups**: Automated daily backups with 7-day retention
- **S3 Versioning**: Version control for stored objects
- **Infrastructure as Code**: Entire infrastructure can be recreated
- **Multi-Region**: Can be deployed to multiple regions

## Performance Metrics

- **Target Response Time**: < 100ms
- **Availability Target**: 99.9%
- **Auto-scaling Triggers**: CPU > 70%, Memory > 75%
- **Database Connections**: Pool size optimized for workload