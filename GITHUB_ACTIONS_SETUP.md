# GitHub Actions Setup Guide

## Required GitHub Secrets

To enable automated deployment via GitHub Actions, you need to add AWS credentials as GitHub Secrets.

### Steps to Add Secrets:

1. **Go to your repository on GitHub**
   - URL: https://github.com/skirino-chaba/RESOLA-Takehome-Challenge

2. **Navigate to Settings**
   - Click on "Settings" tab in your repository
   - In the left sidebar, click "Secrets and variables"
   - Click "Actions"

3. **Add New Repository Secret**
   - Click "New repository secret" button
   - Add the following secrets:

   | Secret Name | Value |
   |------------|-------|
   | `AWS_ACCESS_KEY_ID` | Your AWS Access Key ID |
   | `AWS_SECRET_ACCESS_KEY` | Your AWS Secret Access Key |

### How to Find Your AWS Credentials:

#### Option 1: From AWS CLI Configuration
```bash
cat ~/.aws/credentials
```

Look for:
```
[default]
aws_access_key_id = YOUR_KEY_HERE
aws_secret_access_key = YOUR_SECRET_HERE
```

#### Option 2: From AWS Console
1. Go to AWS Console → IAM → Users
2. Select your user
3. Go to "Security credentials" tab
4. Create new access key if needed

### Testing the Setup

Once you've added the secrets:

1. The GitHub Actions will automatically run on the next push
2. You can manually trigger a workflow:
   - Go to "Actions" tab in your repository
   - Select "Deploy to AWS" workflow
   - Click "Run workflow"

### Current Workflows

- **Test and Validate**: Runs on every push/PR (tests code without deployment)
- **Deploy to AWS**: Deploys to AWS when pushing to main branch

### Security Notes

- Never commit AWS credentials to the repository
- Use IAM roles with minimal required permissions when possible
- Rotate credentials regularly
- Consider using GitHub OIDC provider for temporary credentials (more secure)

## Verification

After adding secrets, the next git push will trigger the workflows and they should pass with green checkmarks ✅