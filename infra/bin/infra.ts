#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { PipelineStack } from '../lib/pipeline-stack';

const app = new cdk.App();

// Configuration
const config = {
  domainName: 'resume.tako.tw',
  githubOwner: 'nfs1a',
  githubRepo: 'tako-resume',
  githubBranch: 'main',
  connectionArn: 'arn:aws:codeconnections:us-east-1:183226280202:connection/810c6cd2-410a-4d95-897b-1d54a19f02d6',
};

// CDK Pipeline Stack (self-mutating)
// This pipeline will:
// 1. Pull code from GitHub
// 2. Synth CDK (update itself if CDK code changed)
// 3. Deploy to Beta
// 4. Manual approval
// 5. Deploy to Prod
new PipelineStack(app, 'ResumePipelineStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'us-east-1',
  },
  domainName: config.domainName,
  githubOwner: config.githubOwner,
  githubRepo: config.githubRepo,
  githubBranch: config.githubBranch,
  connectionArn: config.connectionArn,
});

app.synth();
