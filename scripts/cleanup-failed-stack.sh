#!/bin/bash

# Script to delete failed CloudFormation stack

STACK_NAME="LiteLLM-Data-prod"
REGION="us-east-1"

echo "Checking stack status..."
STACK_STATUS=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --region $REGION --query 'Stacks[0].StackStatus' --output text 2>/dev/null)

if [ "$STACK_STATUS" == "ROLLBACK_COMPLETE" ] || [ "$STACK_STATUS" == "CREATE_FAILED" ]; then
    echo "Stack is in $STACK_STATUS state. Deleting..."
    aws cloudformation delete-stack --stack-name $STACK_NAME --region $REGION
    echo "Waiting for stack deletion..."
    aws cloudformation wait stack-delete-complete --stack-name $STACK_NAME --region $REGION
    echo "Stack deleted successfully!"
else
    echo "Stack is in $STACK_STATUS state or doesn't exist"
fi