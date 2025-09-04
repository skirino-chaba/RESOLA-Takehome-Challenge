import * as cdk from 'aws-cdk-lib';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

interface DataStackProps extends cdk.StackProps {
  config: any;
  vpc: ec2.Vpc;
}

export class DataStack extends cdk.Stack {
  public readonly database: rds.DatabaseInstance;
  public readonly redis: elasticache.CfnCacheCluster;
  public readonly storageBucket: s3.Bucket;
  public readonly backupBucket: s3.Bucket;
  public readonly databaseSecret: secretsmanager.Secret;
  public readonly databaseSecurityGroup: ec2.SecurityGroup;
  public readonly redisSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    const { config, vpc } = props;
    
    // Create security groups
    this.databaseSecurityGroup = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
      vpc,
      description: 'Security group for RDS PostgreSQL',
      allowAllOutbound: false,
    });
    
    // Allow connections from private subnets (where ECS runs)
    vpc.privateSubnets.forEach(subnet => {
      this.databaseSecurityGroup.addIngressRule(
        ec2.Peer.ipv4(subnet.ipv4CidrBlock),
        ec2.Port.tcp(5432),
        'Allow PostgreSQL from private subnet'
      );
    });
    
    this.redisSecurityGroup = new ec2.SecurityGroup(this, 'RedisSecurityGroup', {
      vpc,
      description: 'Security group for ElastiCache Redis',
      allowAllOutbound: false,
    });
    
    // Allow connections from private subnets (where ECS runs)
    vpc.privateSubnets.forEach(subnet => {
      this.redisSecurityGroup.addIngressRule(
        ec2.Peer.ipv4(subnet.ipv4CidrBlock),
        ec2.Port.tcp(6379),
        'Allow Redis from private subnet'
      );
    });
    
    // KMS key for encryption
    const encryptionKey = new kms.Key(this, 'DataEncryptionKey', {
      description: 'KMS key for LiteLLM data encryption',
      enableKeyRotation: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Create secret for database credentials
    this.databaseSecret = new secretsmanager.Secret(this, 'DatabaseSecret', {
      description: 'RDS PostgreSQL credentials',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          username: 'litellmadmin',
        }),
        generateStringKey: 'password',
        excludeCharacters: ' %+~`#$&*()|[]{}:;<>?!\'/@"\\',
        passwordLength: 32,
      },
    });

    // RDS PostgreSQL Database
    const parameterGroup = new rds.ParameterGroup(this, 'PostgresParams', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_14,
      }),
      parameters: {
        'shared_preload_libraries': 'pg_stat_statements',
        'log_statement': 'all',
        'log_duration': '1',
      },
    });

    this.database = new rds.DatabaseInstance(this, 'LiteLLMDatabase', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_14,
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass[config.rds.instanceClass.toUpperCase() as keyof typeof ec2.InstanceClass],
        ec2.InstanceSize[config.rds.instanceSize.toUpperCase() as keyof typeof ec2.InstanceSize]
      ),
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      allocatedStorage: config.rds.allocatedStorage,
      storageType: rds.StorageType.GP3,
      storageEncrypted: true,
      storageEncryptionKey: encryptionKey,
      credentials: rds.Credentials.fromSecret(this.databaseSecret),
      multiAz: config.rds.multiAz || false,
      backupRetention: cdk.Duration.days(config.rds.backupRetention),
      preferredBackupWindow: '03:00-04:00',
      preferredMaintenanceWindow: 'sun:04:00-sun:05:00',
      parameterGroup,
      deletionProtection: config.env === 'prod',
      removalPolicy: config.env === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      monitoringInterval: cdk.Duration.seconds(60),
      enablePerformanceInsights: true,
      performanceInsightRetention: rds.PerformanceInsightRetention.DEFAULT,
    });

    // Add security group to database
    this.database.connections.addSecurityGroup(this.databaseSecurityGroup);

    // ElastiCache Redis
    const redisSubnetGroup = new elasticache.CfnSubnetGroup(this, 'RedisSubnetGroup', {
      description: 'Subnet group for Redis cluster',
      subnetIds: vpc.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      }).subnetIds,
    });

    // Redis parameter group
    const redisParameterGroup = new elasticache.CfnParameterGroup(this, 'RedisParameterGroup', {
      cacheParameterGroupFamily: 'redis7',
      description: 'Redis parameter group for LiteLLM',
      properties: {
        'maxmemory-policy': 'allkeys-lru',
        'timeout': '300',
      },
    });

    this.redis = new elasticache.CfnCacheCluster(this, 'LiteLLMRedis', {
      cacheNodeType: config.redis.nodeType,
      engine: 'redis',
      numCacheNodes: 1, // Redis only supports 1 node - hardcoded to avoid update issues
      cacheSubnetGroupName: redisSubnetGroup.ref,
      cacheParameterGroupName: redisParameterGroup.ref,
      vpcSecurityGroupIds: [this.redisSecurityGroup.securityGroupId],
      preferredMaintenanceWindow: 'sun:05:00-sun:07:00',
      snapshotRetentionLimit: config.env === 'prod' ? 7 : 1,
      snapshotWindow: '03:00-05:00',
      tags: [{
        key: 'Name',
        value: `litellm-redis-${config.env}`,
      }],
    });

    // S3 Buckets - using timestamp suffix to avoid conflicts
    const timestamp = Date.now().toString().substring(6);
    this.storageBucket = new s3.Bucket(this, 'StorageBucket', {
      bucketName: `litellm-storage-${config.env}-${timestamp}`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey,
      versioned: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: config.env === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: config.env !== 'prod',
      lifecycleRules: [{
        id: 'delete-old-versions',
        noncurrentVersionExpiration: cdk.Duration.days(90),
        transitions: [{
          storageClass: s3.StorageClass.INFREQUENT_ACCESS,
          transitionAfter: cdk.Duration.days(30),
        }],
      }],
      cors: [{
        allowedHeaders: ['*'],
        allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
        allowedOrigins: ['*'],
        maxAge: 3000,
      }],
    });

    this.backupBucket = new s3.Bucket(this, 'BackupBucket', {
      bucketName: `litellm-backups-${config.env}-${timestamp}`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey,
      versioned: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [{
        id: 'archive-old-backups',
        transitions: [
          {
            storageClass: s3.StorageClass.GLACIER_INSTANT_RETRIEVAL,
            transitionAfter: cdk.Duration.days(30),
          },
          {
            storageClass: s3.StorageClass.GLACIER,
            transitionAfter: cdk.Duration.days(180),
          },
        ],
        expiration: cdk.Duration.days(365),
      }],
    });

    // Outputs
    new cdk.CfnOutput(this, 'DatabaseEndpoint', {
      value: this.database.dbInstanceEndpointAddress,
      description: 'RDS Database Endpoint',
    });

    new cdk.CfnOutput(this, 'RedisEndpoint', {
      value: this.redis.attrRedisEndpointAddress,
      description: 'Redis Cache Endpoint',
    });

    new cdk.CfnOutput(this, 'StorageBucketName', {
      value: this.storageBucket.bucketName,
      description: 'Storage Bucket Name',
    });
  }
}