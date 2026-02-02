# Tako Resume - Static Website with AWS CI/CD

This project deploys a static resume website to AWS using:
- **S3** - Static website hosting
- **CloudFront** - CDN with HTTPS
- **Route53** - DNS management
- **CodePipeline** - CI/CD from GitHub
- **CDK** - Infrastructure as Code

## Architecture

```
GitHub Repository
       │
       ▼ (push to main)
┌──────────────────┐
│   CodePipeline   │
│  ┌────────────┐  │
│  │   Source   │  │ ← GitHub (CodeConnections)
│  └─────┬──────┘  │
│        ▼         │
│  ┌────────────┐  │
│  │ CodeBuild  │  │ ← Sync to S3 + Invalidate CloudFront
│  └─────┬──────┘  │
└────────┼─────────┘
         ▼
┌──────────────────┐
│    S3 Bucket     │ ← Website content (private, OAC)
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│   CloudFront     │ ← CDN with HTTPS certificate
│     (OAC)        │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│    Route53       │ ← resume.tako.tw → CloudFront
└──────────────────┘
```

## Prerequisites

1. **AWS CLI** configured with appropriate credentials
2. **Node.js** v18+ and npm
3. **AWS CDK** CLI: `npm install -g aws-cdk`
4. **Route53 Hosted Zone** for `tako.tw` already exists in your AWS account
5. **GitHub repository** created for this project

## Setup Instructions

### Step 1: Create GitHub Repository

1. Create a new repository on GitHub (e.g., `tako-resume`)
2. Push this project to the repository:

```bash
cd "/Users/tako/Documents/Tako Resume"
git init
git add .
git commit -m "Initial commit: Resume website with AWS CDK infrastructure"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/tako-resume.git
git push -u origin main
```

### Step 2: Create AWS CodeConnections Connection

1. Go to AWS Console → Developer Tools → Settings → Connections
2. Click "Create connection"
3. Select "GitHub" as the provider
4. Name it (e.g., "github-connection")
5. Click "Connect to GitHub" and authorize AWS
6. Copy the Connection ARN (format: `arn:aws:codeconnections:REGION:ACCOUNT:connection/UUID`)

### Step 3: Update Pipeline Configuration

Edit `infra/lib/pipeline-stack.ts` and replace `REPLACE_WITH_YOUR_CONNECTION_ID` with your actual connection ID:

```typescript
connectionArn: `arn:aws:codeconnections:${this.region}:${this.account}:connection/YOUR-CONNECTION-UUID`,
```

### Step 4: Bootstrap CDK (First Time Only)

```bash
cd infra
npm install
cdk bootstrap aws://YOUR_ACCOUNT_ID/us-east-1
```

### Step 5: Deploy Infrastructure

```bash
cd infra
npm install

# Deploy with your GitHub info
cdk deploy --all \
  -c githubOwner=YOUR_GITHUB_USERNAME \
  -c githubRepo=tako-resume \
  -c githubBranch=main
```

Review the changes and confirm deployment when prompted.

### Step 6: Verify Deployment

1. Check CloudFormation stacks in AWS Console
2. Verify the DNS record in Route53
3. Visit https://resume.tako.tw (may take a few minutes for DNS propagation)

## Project Structure

```
.
├── README.md
├── website/                    # Website source files
│   └── index.html              # Your resume
├── infra/                      # CDK Infrastructure
│   ├── bin/
│   │   └── infra.ts            # CDK app entry point
│   ├── lib/
│   │   ├── website-stack.ts    # S3 + CloudFront + Route53
│   │   └── pipeline-stack.ts   # CodePipeline CI/CD
│   ├── package.json
│   ├── tsconfig.json
│   └── cdk.json
└── Tako_Tsai_Resume_15.html    # Original resume file
```

## CI/CD Workflow

After deployment, any push to the `main` branch will automatically:

1. **Source**: Pull latest code from GitHub
2. **Build & Deploy**:
   - Sync website files to S3
   - Invalidate CloudFront cache for immediate updates

## Useful Commands

```bash
# In the infra directory:
npm run build       # Compile TypeScript
cdk synth           # Generate CloudFormation template
cdk diff            # Compare with deployed stack
cdk deploy --all    # Deploy all stacks
cdk destroy --all   # Destroy all stacks
```

## Cost Estimation

- **S3**: ~$0.023/GB/month (minimal for static site)
- **CloudFront**: Free tier includes 1TB/month data transfer
- **Route53**: $0.50/hosted zone/month + $0.40/million queries
- **CodePipeline**: First pipeline free, then $1/active pipeline/month
- **CodeBuild**: 100 build minutes/month free tier

**Estimated monthly cost**: ~$1-2 for low traffic website

## Troubleshooting

### Certificate Validation Pending
The ACM certificate uses DNS validation. CDK will automatically create the validation records in Route53. Wait 5-10 minutes for validation.

### CloudFront 403 Error
Ensure the S3 bucket policy allows CloudFront OAC access. CDK handles this automatically.

### Pipeline Fails at Source Stage
Verify the CodeConnections connection is in "Available" status and has proper GitHub permissions.

## Security Features

- S3 bucket blocks all public access
- CloudFront uses Origin Access Control (OAC) - latest AWS recommended approach
- HTTPS enforced with redirect from HTTP
- HTTP/2 and HTTP/3 enabled for performance
