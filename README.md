# Tako Resume

Personal resume website hosted on AWS with automated CI/CD deployment.

**Live Site**: https://resume.tako.tw

## Architecture

```
GitHub (main branch)
         │
         ▼
┌─────────────────────────────────────────┐
│            CodePipeline                 │
│  ┌─────────┐   ┌─────────┐   ┌───────┐  │
│  │ Source  │ → │  Synth  │ → │ Beta  │  │
│  │ GitHub  │   │   CDK   │   │ Stage │  │
│  └─────────┘   └─────────┘   └───┬───┘  │
│                                  │      │
│                              ┌───▼───┐  │
│                              │ Prod  │  │
│                              │ Stage │  │
│                              └───────┘  │
└─────────────────────────────────────────┘
                    │
         ┌──────────┴──────────┐
         ▼                     ▼
┌─────────────────┐   ┌─────────────────┐
│   Beta Stack    │   │   Prod Stack    │
│  S3 + CloudFront│   │  S3 + CloudFront│
│  + Route53      │   │  + Route53      │
└────────┬────────┘   └────────┬────────┘
         │                     │
         ▼                     ▼
 beta.resume.tako.tw    resume.tako.tw
```

## Tech Stack

| Component | Service |
|-----------|---------|
| Hosting | S3 (private bucket) |
| CDN | CloudFront (OAC, HTTP/2, HTTP/3) |
| DNS | Route53 |
| SSL/TLS | ACM Certificate |
| CI/CD | CodePipeline + CodeBuild |
| IaC | AWS CDK (TypeScript) |

## Project Structure

```
.
├── website/
│   └── index.html           # Resume HTML
└── infra/
    ├── bin/
    │   └── infra.ts         # CDK entry point
    ├── lib/
    │   ├── website-stack.ts # S3 + CloudFront + Route53
    │   └── pipeline-stack.ts# CI/CD pipeline
    ├── package.json
    └── cdk.json
```

## Deployment

Push to `main` branch triggers automatic deployment:

1. **Source** - Pull from GitHub
2. **Synth** - Compile CDK to CloudFormation
3. **Beta** - Deploy to beta.resume.tako.tw
4. **Prod** - Deploy to resume.tako.tw

## Local Development

```bash
# Install dependencies
cd infra && npm install

# Preview changes
cdk diff --all

# Manual deploy (if needed)
cdk deploy --all
```

## Useful Commands

```bash
npm run build    # Compile TypeScript
cdk synth        # Generate CloudFormation
cdk diff         # Compare with deployed
cdk deploy --all # Deploy all stacks
```

## Cost

~$1-2/month for low traffic:
- S3: ~$0.02/GB
- CloudFront: 1TB/month free
- Route53: ~$0.50/month
- CodePipeline: First pipeline free
