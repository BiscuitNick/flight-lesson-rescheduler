#!/bin/bash
# LocalStack Integration Test for Weather Monitor Lambda
# This script tests the Lambda locally using LocalStack

set -e

echo "========================================="
echo "Weather Monitor Lambda - LocalStack Test"
echo "========================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
AWS_ENDPOINT="http://localhost:4566"
AWS_REGION="us-east-1"
QUEUE_NAME="weather-alerts-queue-test"
LAMBDA_NAME="weather-monitor-test"

echo -e "${YELLOW}Step 1: Checking LocalStack is running...${NC}"
if ! curl -s "${AWS_ENDPOINT}/_localstack/health" > /dev/null; then
    echo -e "${RED}Error: LocalStack is not running!${NC}"
    echo "Start LocalStack with: docker compose up -d"
    exit 1
fi
echo -e "${GREEN}✓ LocalStack is running${NC}"

echo -e "\n${YELLOW}Step 2: Building Lambda function...${NC}"
cd packages/functions/weather-monitor
npm run build
cd ../../..
echo -e "${GREEN}✓ Lambda built successfully${NC}"

echo -e "\n${YELLOW}Step 3: Creating SQS queue...${NC}"
QUEUE_URL=$(aws --endpoint-url="${AWS_ENDPOINT}" \
    --region="${AWS_REGION}" \
    sqs create-queue \
    --queue-name "${QUEUE_NAME}" \
    --query 'QueueUrl' \
    --output text 2>/dev/null || \
    aws --endpoint-url="${AWS_ENDPOINT}" \
    --region="${AWS_REGION}" \
    sqs get-queue-url \
    --queue-name "${QUEUE_NAME}" \
    --query 'QueueUrl' \
    --output text)

echo -e "${GREEN}✓ Queue URL: ${QUEUE_URL}${NC}"

echo -e "\n${YELLOW}Step 4: Creating Lambda function archive...${NC}"
cd packages/functions/weather-monitor
zip -r /tmp/weather-monitor.zip dist/ node_modules/
cd ../../..
echo -e "${GREEN}✓ Lambda archive created${NC}"

echo -e "\n${YELLOW}Step 5: Creating/Updating Lambda function...${NC}"
# Try to create the Lambda, or update if it exists
if aws --endpoint-url="${AWS_ENDPOINT}" \
    --region="${AWS_REGION}" \
    lambda get-function \
    --function-name "${LAMBDA_NAME}" >/dev/null 2>&1; then

    echo "Lambda exists, updating..."
    aws --endpoint-url="${AWS_ENDPOINT}" \
        --region="${AWS_REGION}" \
        lambda update-function-code \
        --function-name "${LAMBDA_NAME}" \
        --zip-file fileb:///tmp/weather-monitor.zip \
        >/dev/null
else
    echo "Creating new Lambda..."
    aws --endpoint-url="${AWS_ENDPOINT}" \
        --region="${AWS_REGION}" \
        lambda create-function \
        --function-name "${LAMBDA_NAME}" \
        --runtime nodejs20.x \
        --handler index.handler \
        --role arn:aws:iam::000000000000:role/lambda-role \
        --zip-file fileb:///tmp/weather-monitor.zip \
        --timeout 120 \
        --memory-size 512 \
        --environment Variables="{
            DATABASE_URL=${DATABASE_URL},
            OPENWEATHERMAP_API_KEY=${OPENWEATHERMAP_API_KEY},
            SQS_QUEUE_URL=${QUEUE_URL},
            AWS_REGION=${AWS_REGION},
            AWS_ENDPOINT_URL=${AWS_ENDPOINT}
        }" \
        >/dev/null
fi
echo -e "${GREEN}✓ Lambda function ready${NC}"

echo -e "\n${YELLOW}Step 6: Invoking Lambda with test event...${NC}"
TEST_EVENT=$(cat <<EOF
{
  "version": "0",
  "id": "test-event-123",
  "detail-type": "Scheduled Event",
  "source": "aws.events",
  "account": "000000000000",
  "time": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "region": "us-east-1",
  "resources": [],
  "detail": {}
}
EOF
)

RESPONSE=$(aws --endpoint-url="${AWS_ENDPOINT}" \
    --region="${AWS_REGION}" \
    lambda invoke \
    --function-name "${LAMBDA_NAME}" \
    --payload "${TEST_EVENT}" \
    /tmp/lambda-response.json 2>&1)

echo -e "${GREEN}✓ Lambda invoked${NC}"

echo -e "\n${YELLOW}Step 7: Checking Lambda response...${NC}"
if [ -f /tmp/lambda-response.json ]; then
    cat /tmp/lambda-response.json | jq .

    # Check if response contains expected data
    if cat /tmp/lambda-response.json | jq -e '.body' >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Lambda executed successfully${NC}"
    else
        echo -e "${RED}✗ Lambda response format unexpected${NC}"
        exit 1
    fi
else
    echo -e "${RED}✗ No response file found${NC}"
    exit 1
fi

echo -e "\n${YELLOW}Step 8: Checking SQS messages...${NC}"
MESSAGES=$(aws --endpoint-url="${AWS_ENDPOINT}" \
    --region="${AWS_REGION}" \
    sqs receive-message \
    --queue-url "${QUEUE_URL}" \
    --max-number-of-messages 10 \
    --wait-time-seconds 2)

if echo "${MESSAGES}" | jq -e '.Messages' >/dev/null 2>&1; then
    MESSAGE_COUNT=$(echo "${MESSAGES}" | jq '.Messages | length')
    echo -e "${GREEN}✓ Found ${MESSAGE_COUNT} messages in queue${NC}"
    echo "${MESSAGES}" | jq '.Messages'
else
    echo -e "${YELLOW}⚠ No messages in queue (expected if no weather conflicts)${NC}"
fi

echo -e "\n${GREEN}========================================="
echo "Test completed successfully!"
echo "=========================================${NC}"

# Cleanup
rm -f /tmp/weather-monitor.zip /tmp/lambda-response.json
