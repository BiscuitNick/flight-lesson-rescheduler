import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';
import * as path from 'path';

export interface AIReschedulerStackProps extends cdk.StackProps {
  /**
   * Database URL for Prisma
   */
  databaseUrl: string;

  /**
   * OpenAI API Key for GPT-4
   */
  openAIApiKey: string;

  /**
   * OpenWeatherMap API Key for forecast checks
   */
  weatherApiKey: string;

  /**
   * Environment (development, staging, production)
   */
  environment: string;

  /**
   * Weather alerts queue ARN from Weather Monitor stack
   */
  weatherAlertsQueueArn: string;

  /**
   * SNS topic ARN for notifications (optional)
   */
  notificationTopicArn?: string;

  /**
   * SNS topic ARN for alerts (optional)
   */
  alertTopicArn?: string;
}

export class AIReschedulerStack extends cdk.Stack {
  public readonly aiReschedulerLambda: lambda.Function;
  public readonly deadLetterQueue: sqs.Queue;
  public readonly notificationTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: AIReschedulerStackProps) {
    super(scope, id, props);

    // ========================================================================
    // Dead Letter Queue for failed reschedule processing
    // ========================================================================
    this.deadLetterQueue = new sqs.Queue(this, 'AIReschedulerDLQ', {
      queueName: `ai-rescheduler-dlq-${props.environment}`,
      retentionPeriod: cdk.Duration.days(14),
      visibilityTimeout: cdk.Duration.seconds(300),
    });

    // ========================================================================
    // SNS Topic for Notifications
    // ========================================================================
    this.notificationTopic = props.notificationTopicArn
      ? sns.Topic.fromTopicArn(
          this,
          'NotificationTopic',
          props.notificationTopicArn
        )
      : new sns.Topic(this, 'NotificationTopic', {
          topicName: `reschedule-notifications-${props.environment}`,
          displayName: 'Reschedule Notifications',
        });

    // ========================================================================
    // Import Weather Alerts Queue from Weather Monitor Stack
    // ========================================================================
    const weatherAlertsQueue = sqs.Queue.fromQueueArn(
      this,
      'WeatherAlertsQueue',
      props.weatherAlertsQueueArn
    );

    // ========================================================================
    // AI Rescheduler Lambda Function
    // ========================================================================
    this.aiReschedulerLambda = new lambda.Function(this, 'AIReschedulerLambda', {
      functionName: `ai-rescheduler-${props.environment}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(
        path.join(__dirname, '../../packages/functions/ai-rescheduler/dist')
      ),
      timeout: cdk.Duration.minutes(2),
      memorySize: 1024, // More memory for AI processing
      environment: {
        DATABASE_URL: props.databaseUrl,
        OPENAI_API_KEY: props.openAIApiKey,
        OPENWEATHERMAP_API_KEY: props.weatherApiKey,
        SNS_TOPIC_ARN: this.notificationTopic.topicArn,
        AWS_REGION: this.region,
        NODE_ENV: props.environment,
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
      retryAttempts: 2,
      reservedConcurrentExecutions: 10, // Limit concurrent GPT-4 calls
      description: 'AI-powered flight lesson rescheduler using GPT-4',
    });

    // Grant permissions
    this.notificationTopic.grantPublish(this.aiReschedulerLambda);
    this.deadLetterQueue.grantSendMessages(this.aiReschedulerLambda);

    // ========================================================================
    // SQS Event Source - Process weather alerts
    // ========================================================================
    this.aiReschedulerLambda.addEventSource(
      new lambdaEventSources.SqsEventSource(weatherAlertsQueue, {
        batchSize: 5, // Process up to 5 bookings at once
        maxBatchingWindow: cdk.Duration.seconds(30),
        reportBatchItemFailures: true, // Enable partial batch responses
      })
    );

    // ========================================================================
    // CloudWatch Alarms & Monitoring
    // ========================================================================

    // Alarm: Lambda errors
    const errorAlarm = new cloudwatch.Alarm(this, 'AIReschedulerErrorAlarm', {
      alarmName: `ai-rescheduler-errors-${props.environment}`,
      alarmDescription: 'Alert when AI Rescheduler Lambda has errors',
      metric: this.aiReschedulerLambda.metricErrors({
        period: cdk.Duration.minutes(5),
        statistic: 'Sum',
      }),
      threshold: 3,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // Alarm: Lambda duration (performance)
    const durationAlarm = new cloudwatch.Alarm(this, 'AIReschedulerDurationAlarm', {
      alarmName: `ai-rescheduler-duration-${props.environment}`,
      alarmDescription: 'Alert when AI Rescheduler Lambda is slow',
      metric: this.aiReschedulerLambda.metricDuration({
        period: cdk.Duration.minutes(5),
        statistic: 'Average',
      }),
      threshold: 90000, // 90 seconds (approaching 2-minute timeout)
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // Alarm: Lambda throttles (concurrency limit hit)
    const throttleAlarm = new cloudwatch.Alarm(this, 'AIReschedulerThrottleAlarm', {
      alarmName: `ai-rescheduler-throttles-${props.environment}`,
      alarmDescription: 'Alert when AI Rescheduler Lambda is throttled',
      metric: this.aiReschedulerLambda.metricThrottles({
        period: cdk.Duration.minutes(5),
        statistic: 'Sum',
      }),
      threshold: 5,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // Alarm: DLQ depth (messages in dead letter queue)
    const dlqAlarm = new cloudwatch.Alarm(this, 'AIReschedulerDLQAlarm', {
      alarmName: `ai-rescheduler-dlq-${props.environment}`,
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
      throttleAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(alertTopic));
      dlqAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(alertTopic));
    }

    // ========================================================================
    // CloudWatch Dashboard
    // ========================================================================
    const dashboard = new cloudwatch.Dashboard(this, 'AIReschedulerDashboard', {
      dashboardName: `ai-rescheduler-${props.environment}`,
    });

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Lambda Invocations',
        left: [this.aiReschedulerLambda.metricInvocations()],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'Lambda Errors & Throttles',
        left: [
          this.aiReschedulerLambda.metricErrors(),
          this.aiReschedulerLambda.metricThrottles(),
        ],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'Lambda Duration',
        left: [
          this.aiReschedulerLambda.metricDuration({ statistic: 'Average' }),
          this.aiReschedulerLambda.metricDuration({ statistic: 'p99' }),
        ],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'DLQ Depth',
        left: [this.deadLetterQueue.metricApproximateNumberOfMessagesVisible()],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'Concurrent Executions',
        left: [this.aiReschedulerLambda.metricConcurrentExecutions()],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'SNS Notifications Published',
        left: [this.notificationTopic.metricNumberOfMessagesPublished()],
        width: 12,
      })
    );

    // ========================================================================
    // Stack Outputs
    // ========================================================================
    new cdk.CfnOutput(this, 'AIReschedulerLambdaArn', {
      value: this.aiReschedulerLambda.functionArn,
      description: 'AI Rescheduler Lambda ARN',
      exportName: `AIReschedulerLambdaArn-${props.environment}`,
    });

    new cdk.CfnOutput(this, 'NotificationTopicArn', {
      value: this.notificationTopic.topicArn,
      description: 'Notification SNS Topic ARN',
      exportName: `NotificationTopicArn-${props.environment}`,
    });

    new cdk.CfnOutput(this, 'DLQUrl', {
      value: this.deadLetterQueue.queueUrl,
      description: 'AI Rescheduler DLQ URL',
      exportName: `AIReschedulerDLQUrl-${props.environment}`,
    });

    new cdk.CfnOutput(this, 'DashboardUrl', {
      value: `https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${dashboard.dashboardName}`,
      description: 'CloudWatch Dashboard URL',
    });
  }
}
