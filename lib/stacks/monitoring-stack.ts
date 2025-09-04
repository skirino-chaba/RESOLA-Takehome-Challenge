import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';

interface MonitoringStackProps extends cdk.StackProps {
  config: any;
  service: ecs.FargateService;
  loadBalancer: elbv2.ApplicationLoadBalancer;
  database: rds.DatabaseInstance;
}

export class MonitoringStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    const { config, service, loadBalancer, database } = props;

    // SNS Topic for Alarms
    const alarmTopic = new sns.Topic(this, 'AlarmTopic', {
      displayName: `LiteLLM Alarms - ${config.env}`,
    });

    // Add email subscription (replace with your email)
    // alarmTopic.addSubscription(
    //   new subscriptions.EmailSubscription('your-email@example.com')
    // );

    // ECS Service CPU Alarm
    const cpuAlarm = new cloudwatch.Alarm(this, 'HighCPUAlarm', {
      metric: service.metricCpuUtilization(),
      threshold: 80,
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      treatMissingData: cloudwatch.TreatMissingData.BREACHING,
      alarmDescription: 'Alarm when CPU exceeds 80%',
    });
    cpuAlarm.addAlarmAction(new cloudwatchActions.SnsAction(alarmTopic));

    // ECS Service Memory Alarm
    const memoryAlarm = new cloudwatch.Alarm(this, 'HighMemoryAlarm', {
      metric: service.metricMemoryUtilization(),
      threshold: 85,
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      treatMissingData: cloudwatch.TreatMissingData.BREACHING,
      alarmDescription: 'Alarm when memory exceeds 85%',
    });
    memoryAlarm.addAlarmAction(new cloudwatchActions.SnsAction(alarmTopic));

    // ALB Target Health Alarm
    const unhealthyTargetsAlarm = new cloudwatch.Alarm(this, 'UnhealthyTargetsAlarm', {
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApplicationELB',
        metricName: 'UnHealthyHostCount',
        dimensionsMap: {
          LoadBalancer: loadBalancer.loadBalancerFullName,
        },
        statistic: 'Average',
      }),
      threshold: 0.5,
      evaluationPeriods: 2,
      alarmDescription: 'Alarm when we have unhealthy targets',
    });
    unhealthyTargetsAlarm.addAlarmAction(new cloudwatchActions.SnsAction(alarmTopic));

    // RDS CPU Alarm
    const dbCpuAlarm = new cloudwatch.Alarm(this, 'DatabaseHighCPUAlarm', {
      metric: database.metricCPUUtilization(),
      threshold: 75,
      evaluationPeriods: 2,
      alarmDescription: 'Alarm when database CPU exceeds 75%',
    });
    dbCpuAlarm.addAlarmAction(new cloudwatchActions.SnsAction(alarmTopic));

    // RDS Connection Count Alarm
    const dbConnectionAlarm = new cloudwatch.Alarm(this, 'DatabaseConnectionAlarm', {
      metric: database.metricDatabaseConnections(),
      threshold: 40,
      evaluationPeriods: 2,
      alarmDescription: 'Alarm when database connections exceed 40',
    });
    dbConnectionAlarm.addAlarmAction(new cloudwatchActions.SnsAction(alarmTopic));

    // CloudWatch Dashboard
    const dashboard = new cloudwatch.Dashboard(this, 'LiteLLMDashboard', {
      dashboardName: `litellm-dashboard-${config.env}`,
      widgets: [
        [
          new cloudwatch.GraphWidget({
            title: 'ECS Service Metrics',
            left: [service.metricCpuUtilization()],
            right: [service.metricMemoryUtilization()],
            width: 12,
            height: 6,
          }),
          new cloudwatch.GraphWidget({
            title: 'ALB Request Count',
            left: [
              new cloudwatch.Metric({
                namespace: 'AWS/ApplicationELB',
                metricName: 'RequestCount',
                dimensionsMap: {
                  LoadBalancer: loadBalancer.loadBalancerFullName,
                },
                statistic: 'Sum',
              }),
            ],
            width: 12,
            height: 6,
          }),
        ],
        [
          new cloudwatch.GraphWidget({
            title: 'Database Metrics',
            left: [database.metricCPUUtilization()],
            right: [database.metricDatabaseConnections()],
            width: 12,
            height: 6,
          }),
          new cloudwatch.GraphWidget({
            title: 'Target Response Time',
            left: [
              new cloudwatch.Metric({
                namespace: 'AWS/ApplicationELB',
                metricName: 'TargetResponseTime',
                dimensionsMap: {
                  LoadBalancer: loadBalancer.loadBalancerFullName,
                },
                statistic: 'Average',
              }),
            ],
            width: 12,
            height: 6,
          }),
        ],
      ],
    });

    // Outputs
    new cdk.CfnOutput(this, 'DashboardURL', {
      value: `https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${dashboard.dashboardName}`,
      description: 'CloudWatch Dashboard URL',
    });
  }
}