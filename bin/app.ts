#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { NetworkStack } from '../lib/stacks/network-stack';
import { DataStack } from '../lib/stacks/data-stack';
import { ComputeStack } from '../lib/stacks/compute-stack';
import { MonitoringStack } from '../lib/stacks/monitoring-stack';
import { EdgeStack } from '../lib/stacks/edge-stack';

const app = new cdk.App();

// Get environment from context
const envName = app.node.tryGetContext('env') || 'dev';
const config = require(`../config/${envName}.json`);

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: config.region || process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

// Network Stack - VPC, Subnets, Security Groups
const networkStack = new NetworkStack(app, `LiteLLM-Network-${envName}`, {
  env,
  config,
  description: 'Network infrastructure for LiteLLM Proxy',
});

// Data Stack - RDS, ElastiCache, S3
const dataStack = new DataStack(app, `LiteLLM-Data-${envName}`, {
  env,
  config,
  vpc: networkStack.vpc,
  description: 'Data layer for LiteLLM Proxy',
});

// Compute Stack - ECS, ALB, Auto-scaling
const computeStack = new ComputeStack(app, `LiteLLM-Compute-${envName}`, {
  env,
  config,
  vpc: networkStack.vpc,
  database: dataStack.database,
  redis: dataStack.redis,
  description: 'Compute infrastructure for LiteLLM Proxy',
});

// Monitoring Stack
const monitoringStack = new MonitoringStack(app, `LiteLLM-Monitoring-${envName}`, {
  env,
  config,
  service: computeStack.service,
  loadBalancer: computeStack.loadBalancer,
  database: dataStack.database,
  description: 'Monitoring and alerting for LiteLLM',
});

// Edge Stack - CloudFront, Route53, WAF (Production only)
if (config.cloudfront?.enabled) {
  const edgeStack = new EdgeStack(app, `LiteLLM-Edge-${envName}`, {
    env,
    config,
    loadBalancer: computeStack.loadBalancer,
    description: 'Edge services for LiteLLM Proxy',
  });
}

// Add tags to all stacks
cdk.Tags.of(app).add('Project', 'LiteLLM-Proxy');
cdk.Tags.of(app).add('Environment', envName);
cdk.Tags.of(app).add('ManagedBy', 'CDK');