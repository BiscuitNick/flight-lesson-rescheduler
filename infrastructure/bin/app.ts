#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { WeatherMonitorStack } from '../lib/weather-monitor-stack';

const app = new cdk.App();

// Get environment from context or default to 'development'
const environment = app.node.tryGetContext('environment') || 'development';

// Get configuration from context
const databaseUrl = app.node.tryGetContext('databaseUrl') || process.env.DATABASE_URL || '';
const weatherApiKey = app.node.tryGetContext('weatherApiKey') || process.env.OPENWEATHERMAP_API_KEY || '';
const alertTopicArn = app.node.tryGetContext('alertTopicArn') || process.env.ALERT_TOPIC_ARN;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required. Set via context or environment variable.');
}

if (!weatherApiKey) {
  throw new Error('OPENWEATHERMAP_API_KEY is required. Set via context or environment variable.');
}

new WeatherMonitorStack(app, `FlightReschedulerWeatherMonitor-${environment}`, {
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
});

app.synth();
