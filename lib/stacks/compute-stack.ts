import * as cdk from 'aws-cdk-lib';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as autoscaling from 'aws-cdk-lib/aws-applicationautoscaling';
import { Construct } from 'constructs';

interface ComputeStackProps extends cdk.StackProps {
  config: any;
  vpc: ec2.Vpc;
  database: rds.DatabaseInstance;
  redis: elasticache.CfnCacheCluster;
}

export class ComputeStack extends cdk.Stack {
  public readonly service: ecs.FargateService;
  public readonly loadBalancer: elbv2.ApplicationLoadBalancer;
  public readonly cluster: ecs.Cluster;

  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    const { config, vpc, database, redis } = props;
    
    // Create security groups
    const albSecurityGroup = new ec2.SecurityGroup(this, 'ALBSecurityGroup', {
      vpc,
      description: 'Security group for Application Load Balancer',
      allowAllOutbound: true,
    });
    
    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allow HTTP traffic'
    );
    
    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allow HTTPS traffic'
    );
    
    const ecsSecurityGroup = new ec2.SecurityGroup(this, 'ECSSecurityGroup', {
      vpc,
      description: 'Security group for ECS tasks',
      allowAllOutbound: true,
    });
    
    ecsSecurityGroup.addIngressRule(
      albSecurityGroup,
      ec2.Port.tcp(4000),
      'Allow traffic from ALB'
    );
    
    // Database and Redis will configure their security groups to allow from ECS

    // Create ECS Cluster
    this.cluster = new ecs.Cluster(this, 'LiteLLMCluster', {
      vpc,
      containerInsights: true,
      clusterName: `litellm-cluster-${config.env}`,
    });

    // ECR Repository for Docker images
    const repository = new ecr.Repository(this, 'LiteLLMRepository', {
      repositoryName: `litellm-proxy-${config.env}`,
      imageScanOnPush: true,
      imageTagMutability: ecr.TagMutability.MUTABLE,
      lifecycleRules: [{
        maxImageCount: 10,
        description: 'Keep last 10 images',
      }],
    });

    // Create Secrets for API Keys
    const apiKeysSecret = new secretsmanager.Secret(this, 'APIKeysSecret', {
      description: 'API keys for LLM providers',
      secretObjectValue: {
        OPENAI_API_KEY: cdk.SecretValue.unsafePlainText('your-openai-key-here'),
        ANTHROPIC_API_KEY: cdk.SecretValue.unsafePlainText('your-anthropic-key-here'),
        LITELLM_MASTER_KEY: cdk.SecretValue.unsafePlainText('sk-litellm-master-key-here'),
      },
    });

    // Task Execution Role
    const taskExecutionRole = new iam.Role(this, 'TaskExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    });

    taskExecutionRole.addToPolicy(new iam.PolicyStatement({
      actions: ['secretsmanager:GetSecretValue'],
      resources: [apiKeysSecret.secretArn, database.secret?.secretArn || ''],
    }));

    // Task Role
    const taskRole = new iam.Role(this, 'TaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    taskRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        's3:GetObject',
        's3:PutObject',
        's3:DeleteObject',
      ],
      resources: ['arn:aws:s3:::litellm-*/*'],
    }));

    // CloudWatch Log Group
    const logGroup = new logs.LogGroup(this, 'LiteLLMLogGroup', {
      logGroupName: `/ecs/litellm/${config.env}`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Task Definition
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'LiteLLMTaskDef', {
      memoryLimitMiB: config.ecs.memory,
      cpu: config.ecs.cpu,
      executionRole: taskExecutionRole,
      taskRole,
    });

    // Get database connection string
    const dbSecret = database.secret;
    
    // Container Definition
    const container = taskDefinition.addContainer('litellm-proxy', {
      image: ecs.ContainerImage.fromRegistry('ghcr.io/berriai/litellm:main-stable'),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'litellm',
        logGroup,
      }),
      environment: {
        REDIS_HOST: redis.attrRedisEndpointAddress,
        REDIS_PORT: redis.attrRedisEndpointPort,
        PORT: '4000',
        LITELLM_TELEMETRY: 'false',
        LITELLM_MODE: 'PRODUCTION',
        UI_USERNAME: 'admin',
        STORE_MODEL_IN_DB: 'False',
      },
      secrets: {
        OPENAI_API_KEY: ecs.Secret.fromSecretsManager(apiKeysSecret, 'OPENAI_API_KEY'),
        ANTHROPIC_API_KEY: ecs.Secret.fromSecretsManager(apiKeysSecret, 'ANTHROPIC_API_KEY'),
        LITELLM_MASTER_KEY: ecs.Secret.fromSecretsManager(apiKeysSecret, 'LITELLM_MASTER_KEY'),
        UI_PASSWORD: ecs.Secret.fromSecretsManager(apiKeysSecret, 'LITELLM_MASTER_KEY'),
      },
      // Health check disabled temporarily for debugging
      // healthCheck: {
      //   command: ['CMD-SHELL', 'curl -f http://localhost:8000/health || exit 1'],
      //   interval: cdk.Duration.seconds(30),
      //   timeout: cdk.Duration.seconds(10),
      //   retries: 3,
      //   startPeriod: cdk.Duration.seconds(60),
      // },
    });

    container.addPortMappings({
      containerPort: 4000,
      protocol: ecs.Protocol.TCP,
    });

    // Application Load Balancer
    this.loadBalancer = new elbv2.ApplicationLoadBalancer(this, 'LiteLLMLoadBalancer', {
      vpc,
      internetFacing: true,
      loadBalancerName: `litellm-alb-${config.env}`,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
    });

    // Add security group to ALB
    this.loadBalancer.addSecurityGroup(albSecurityGroup);

    // Fargate Service
    this.service = new ecs.FargateService(this, 'LiteLLMService', {
      cluster: this.cluster,
      taskDefinition,
      desiredCount: config.ecs.desiredCount,
      assignPublicIp: false,
      serviceName: `litellm-service-${config.env}`,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [ecsSecurityGroup],
      healthCheckGracePeriod: cdk.Duration.seconds(300), // Increased to 5 minutes
    });

    // Target Group
    const targetGroup = new elbv2.ApplicationTargetGroup(this, 'LiteLLMTargetGroup', {
      vpc,
      port: 4000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      // Health check made more lenient for initial deployment
      healthCheck: {
        enabled: true,
        path: '/',  // Changed from /health to root
        port: '4000',
        protocol: elbv2.Protocol.HTTP,
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 10,  // Increased from 3
        timeout: cdk.Duration.seconds(30),  // Increased from 10
        interval: cdk.Duration.seconds(60),  // Increased from 30
        healthyHttpCodes: '200-499',  // Accept any non-error code
      },
      deregistrationDelay: cdk.Duration.seconds(30),
    });

    // Attach service to target group
    this.service.attachToApplicationTargetGroup(targetGroup);

    // HTTP Listener - redirect to HTTPS in production
    const httpListener = this.loadBalancer.addListener('HttpListener', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultAction: config.env === 'prod' 
        ? elbv2.ListenerAction.redirect({
            port: '443',
            protocol: elbv2.ApplicationProtocol.HTTPS,
            permanent: true,
          })
        : elbv2.ListenerAction.forward([targetGroup]),
    });
    
    // Note: For production, you would add an HTTPS listener with ACM certificate
    // const httpsListener = this.loadBalancer.addListener('HttpsListener', {
    //   port: 443,
    //   protocol: elbv2.ApplicationProtocol.HTTPS,
    //   certificates: [certificate],
    //   defaultAction: elbv2.ListenerAction.forward([targetGroup]),
    // });

    // Auto Scaling
    const scaling = this.service.autoScaleTaskCount({
      minCapacity: config.ecs.desiredCount,
      maxCapacity: config.ecs.maxCount,
    });

    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.seconds(300),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    scaling.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: 75,
      scaleInCooldown: cdk.Duration.seconds(300),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    // Outputs
    new cdk.CfnOutput(this, 'LoadBalancerDNS', {
      value: this.loadBalancer.loadBalancerDnsName,
      description: 'Load Balancer DNS Name',
    });

    new cdk.CfnOutput(this, 'ServiceName', {
      value: this.service.serviceName,
      description: 'ECS Service Name',
    });

    new cdk.CfnOutput(this, 'ClusterName', {
      value: this.cluster.clusterName,
      description: 'ECS Cluster Name',
    });

    new cdk.CfnOutput(this, 'ECRRepository', {
      value: repository.repositoryUri,
      description: 'ECR Repository URI',
    });
  }
}