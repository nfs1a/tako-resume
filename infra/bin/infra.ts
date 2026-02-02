#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { WebsiteStack } from '../lib/website-stack';
import { PipelineStack } from '../lib/pipeline-stack';

const app = new cdk.App();

// Configuration
const config = {
  domainName: 'resume.tako.tw',
  githubOwner: app.node.tryGetContext('githubOwner') || 'YOUR_GITHUB_USERNAME',
  githubRepo: app.node.tryGetContext('githubRepo') || 'tako-resume',
  githubBranch: app.node.tryGetContext('githubBranch') || 'main',
};

// Website Stack (S3 + CloudFront)
// Must be deployed in us-east-1 for ACM certificate with CloudFront
// DNS is managed in Cloudflare - you'll add CNAME manually
const websiteStack = new WebsiteStack(app, 'ResumeWebsiteStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'us-east-1', // Required for CloudFront + ACM
  },
  domainName: config.domainName,
  crossRegionReferences: true,
});

// CI/CD Pipeline Stack
const pipelineStack = new PipelineStack(app, 'ResumePipelineStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'us-east-1',
  },
  websiteBucket: websiteStack.websiteBucket,
  distribution: websiteStack.distribution,
  githubOwner: config.githubOwner,
  githubRepo: config.githubRepo,
  githubBranch: config.githubBranch,
});

pipelineStack.addDependency(websiteStack);

app.synth();
