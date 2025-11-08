#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { WeatherMonitorStack } from '../lib/weather-monitor-stack';
import { AIReschedulerStack } from '../lib/ai-rescheduler-stack';

const app = new cdk.App();

// Get environment from context or default to 'development'
const environment = app.node.tryGetContext('environment') || 'development';

// Get configuration from context
const databaseUrl = app.node.tryGetContext('databaseUrl') || process.env.DATABASE_URL || '';
const weatherApiKey = app.node.tryGetContext('weatherApiKey') || process.env.OPENWEATHERMAP_API_KEY || '';
const openAIApiKey = app.node.tryGetContext('openAIApiKey') || process.env.OPENAI_API_KEY || '';
const alertTopicArn = app.node.tryGetContext('alertTopicArn') || process.env.ALERT_TOPIC_ARN;
const notificationTopicArn = app.node.tryGetContext('notificationTopicArn') || process.env.NOTIFICATION_TOPIC_ARN;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required. Set via context or environment variable.');
}

if (!weatherApiKey) {
  throw new Error('OPENWEATHERMAP_API_KEY is required. Set via context or environment variable.');
}

if (!openAIApiKey) {
  throw new Error('OPENAI_API_KEY is required. Set via context or environment variable.');
}

// ============================================================================
// Weather Monitor Stack
// ============================================================================
const weatherMonitorStack = new WeatherMonitorStack(
  app,
  `FlightReschedulerWeatherMonitor-${environment}`,
  {
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
    },
    databaseUrl,
    weatherApiKey,
    environment,
    alertTopicArn,
    description: `Flight Lesson Rescheduler - Weather Monitor Lambda (${environment})`,
    tags: {
      Project: 'FlightLessonRescheduler',
      Component: 'WeatherMonitor',
      Environment: environment,
      ManagedBy: 'CDK',
    },
  }
);

// ============================================================================
// AI Rescheduler Stack (depends on Weather Monitor for queue)
// ============================================================================
const aiReschedulerStack = new AIReschedulerStack(
  app,
  `FlightReschedulerAIRescheduler-${environment}`,
  {
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
    },
    databaseUrl,
    openAIApiKey,
    weatherApiKey,
    environment,
    weatherAlertsQueueArn: weatherMonitorStack.weatherQueue.queueArn,
    notificationTopicArn,
    alertTopicArn,
    description: `Flight Lesson Rescheduler - AI Rescheduler Lambda (${environment})`,
    tags: {
      Project: 'FlightLessonRescheduler',
      Component: 'AIRescheduler',
      Environment: environment,
      ManagedBy: 'CDK',
    },
  }
);

// Add dependency to ensure Weather Monitor is deployed first
aiReschedulerStack.addDependency(weatherMonitorStack);

app.synth();
