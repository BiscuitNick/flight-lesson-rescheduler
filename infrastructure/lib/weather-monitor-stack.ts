import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as path from 'path';

export interface WeatherMonitorStackProps extends cdk.StackProps {
  /**
   * Database URL for Prisma
   */
  databaseUrl: string;

  /**
   * OpenWeatherMap API Key
   */
  weatherApiKey: string;

  /**
   * Environment (development, staging, production)
   */
  environment: string;

  /**
   * SNS topic ARN for alerts (optional)
   */
  alertTopicArn?: string;
}

export class WeatherMonitorStack extends cdk.Stack {
  public readonly weatherQueue: sqs.Queue;
  public readonly weatherMonitorLambda: lambda.Function;
  public readonly deadLetterQueue: sqs.Queue;

  constructor(scope: Construct, id: string, props: WeatherMonitorStackProps) {
    super(scope, id, props);

    // ========================================================================
    // Dead Letter Queue for failed weather checks
    // ========================================================================
    this.deadLetterQueue = new sqs.Queue(this, 'WeatherMonitorDLQ', {
      queueName: `weather-monitor-dlq-${props.environment}`,
      retentionPeriod: cdk.Duration.days(14),
      visibilityTimeout: cdk.Duration.seconds(300),
    });

    // ========================================================================
    // Main SQS Queue for weather conflicts
    // ========================================================================
    this.weatherQueue = new sqs.Queue(this, 'WeatherAlertsQueue', {
      queueName: `weather-alerts-queue-${props.environment}`,
      visibilityTimeout: cdk.Duration.minutes(5),
      retentionPeriod: cdk.Duration.days(4),
      receiveMessageWaitTime: cdk.Duration.seconds(20), // Long polling
      deadLetterQueue: {
        queue: this.deadLetterQueue,
        maxReceiveCount: 3, // Retry 3 times before sending to DLQ
      },
    });

    // ========================================================================
    // Weather Monitor Lambda Function
    // ========================================================================
    this.weatherMonitorLambda = new lambda.Function(this, 'WeatherMonitorLambda', {
      functionName: `weather-monitor-${props.environment}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(
        path.join(__dirname, '../../packages/functions/weather-monitor/dist')
      ),
      timeout: cdk.Duration.minutes(2),
      memorySize: 512,
      environment: {
        DATABASE_URL: props.databaseUrl,
        OPENWEATHERMAP_API_KEY: props.weatherApiKey,
        SQS_QUEUE_URL: this.weatherQueue.queueUrl,
        AWS_REGION: this.region,
        NODE_ENV: props.environment,
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
      retryAttempts: 2,
      description: 'Hourly weather monitor for flight bookings',
    });

    // Grant SQS permissions to Lambda
    this.weatherQueue.grantSendMessages(this.weatherMonitorLambda);
    this.deadLetterQueue.grantSendMessages(this.weatherMonitorLambda);

    // Grant VPC/RDS access if needed (for production)
    // Note: In production, you would configure VPC access here
    // this.weatherMonitorLambda.connections.allowToDefaultPort(dbSecurityGroup);

    // ========================================================================
    // EventBridge Rule - Trigger hourly
    // ========================================================================
    const hourlyRule = new events.Rule(this, 'WeatherMonitorHourlyRule', {
      ruleName: `weather-monitor-hourly-${props.environment}`,
      description: 'Trigger weather monitor Lambda every hour',
      schedule: events.Schedule.cron({
        minute: '0', // Run at the top of every hour
        hour: '*',
        day: '*',
        month: '*',
        year: '*',
      }),
    });

    // Add Lambda as target
    hourlyRule.addTarget(
      new targets.LambdaFunction(this.weatherMonitorLambda, {
        retryAttempts: 2,
      })
    );

    // ========================================================================
    // CloudWatch Alarms & Monitoring
    // ========================================================================

    // Alarm: Lambda errors
    const errorAlarm = new cloudwatch.Alarm(this, 'WeatherMonitorErrorAlarm', {
      alarmName: `weather-monitor-errors-${props.environment}`,
      alarmDescription: 'Alert when Weather Monitor Lambda has errors',
      metric: this.weatherMonitorLambda.metricErrors({
        period: cdk.Duration.minutes(5),
        statistic: 'Sum',
      }),
      threshold: 3,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // Alarm: Lambda duration (performance)
    const durationAlarm = new cloudwatch.Alarm(this, 'WeatherMonitorDurationAlarm', {
      alarmName: `weather-monitor-duration-${props.environment}`,
      alarmDescription: 'Alert when Weather Monitor Lambda is slow',
      metric: this.weatherMonitorLambda.metricDuration({
        period: cdk.Duration.minutes(5),
        statistic: 'Average',
      }),
      threshold: 90000, // 90 seconds (approaching 2-minute timeout)
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // Alarm: DLQ depth (messages in dead letter queue)
    const dlqAlarm = new cloudwatch.Alarm(this, 'WeatherMonitorDLQAlarm', {
      alarmName: `weather-monitor-dlq-${props.environment}`,
      alarmDescription: 'Alert when messages land in DLQ',
      metric: this.deadLetterQueue.metricApproximateNumberOfMessagesVisible({
        period: cdk.Duration.minutes(5),
        statistic: 'Sum',
      }),
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // If SNS topic is provided, add alarm actions
    if (props.alertTopicArn) {
      const alertTopic = sns.Topic.fromTopicArn(
        this,
        'AlertTopic',
        props.alertTopicArn
      );

      errorAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(alertTopic));
      durationAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(alertTopic));
      dlqAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(alertTopic));
    }

    // ========================================================================
    // CloudWatch Dashboard
    // ========================================================================
    const dashboard = new cloudwatch.Dashboard(this, 'WeatherMonitorDashboard', {
      dashboardName: `weather-monitor-${props.environment}`,
    });

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Lambda Invocations',
        left: [this.weatherMonitorLambda.metricInvocations()],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'Lambda Errors',
        left: [this.weatherMonitorLambda.metricErrors()],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'Lambda Duration',
        left: [this.weatherMonitorLambda.metricDuration()],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'SQS Queue Depth',
        left: [
          this.weatherQueue.metricApproximateNumberOfMessagesVisible(),
          this.deadLetterQueue.metricApproximateNumberOfMessagesVisible(),
        ],
        width: 12,
      })
    );

    // ========================================================================
    // Stack Outputs
    // ========================================================================
    new cdk.CfnOutput(this, 'WeatherQueueUrl', {
      value: this.weatherQueue.queueUrl,
      description: 'Weather alerts SQS queue URL',
      exportName: `WeatherQueueUrl-${props.environment}`,
    });

    new cdk.CfnOutput(this, 'WeatherQueueArn', {
      value: this.weatherQueue.queueArn,
      description: 'Weather alerts SQS queue ARN',
      exportName: `WeatherQueueArn-${props.environment}`,
    });

    new cdk.CfnOutput(this, 'WeatherMonitorLambdaArn', {
      value: this.weatherMonitorLambda.functionArn,
      description: 'Weather Monitor Lambda ARN',
      exportName: `WeatherMonitorLambdaArn-${props.environment}`,
    });

    new cdk.CfnOutput(this, 'DashboardUrl', {
      value: `https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${dashboard.dashboardName}`,
      description: 'CloudWatch Dashboard URL',
    });
  }
}
