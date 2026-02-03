import * as cdk from 'aws-cdk-lib';
import * as pipelines from 'aws-cdk-lib/pipelines';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { WebsiteStack, Stage as WebsiteStage } from './website-stack';

// Stage for deploying website to an environment
class WebsiteDeployStage extends cdk.Stage {
  public readonly websiteStack: WebsiteStack;

  constructor(scope: Construct, id: string, props: {
    domainName: string;
    stage: WebsiteStage;
  } & cdk.StageProps) {
    super(scope, id, props);

    this.websiteStack = new WebsiteStack(this, 'WebsiteStack', {
      domainName: props.domainName,
      stage: props.stage,
    });
  }
}

export interface PipelineStackProps extends cdk.StackProps {
  domainName: string;
  githubOwner: string;
  githubRepo: string;
  githubBranch: string;
  connectionArn: string;
}

export class PipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);

    // Source from GitHub
    const source = pipelines.CodePipelineSource.connection(
      `${props.githubOwner}/${props.githubRepo}`,
      props.githubBranch,
      {
        connectionArn: props.connectionArn,
      }
    );

    // CDK Pipeline - self-mutating!
    const pipeline = new pipelines.CodePipeline(this, 'Pipeline', {
      pipelineName: 'ResumeWebsitePipeline',
      synth: new pipelines.ShellStep('Synth', {
        input: source,
        commands: [
          'cd infra',
          'npm ci',
          'npm run build',
          'npx cdk synth',
        ],
        primaryOutputDirectory: 'infra/cdk.out',
      }),
      // Self-mutation enabled by default
      selfMutation: true,
    });

    // Beta Stage - deploy automatically
    const betaStage = new WebsiteDeployStage(this, 'Beta', {
      domainName: props.domainName,
      stage: 'beta',
      env: {
        account: this.account,
        region: 'us-east-1',
      },
    });
    pipeline.addStage(betaStage, {
      post: [
        new pipelines.CodeBuildStep('DeployWebsiteContent', {
          input: source,
          envFromCfnOutputs: {
            BUCKET_NAME: betaStage.websiteStack.bucketNameOutput,
            DISTRIBUTION_ID: betaStage.websiteStack.distributionIdOutput,
          },
          commands: [
            'aws s3 sync website/ s3://$BUCKET_NAME/ --delete',
            'aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths "/*"',
          ],
          rolePolicyStatements: [
            new iam.PolicyStatement({
              actions: ['s3:ListBucket', 's3:GetObject', 's3:PutObject', 's3:DeleteObject'],
              resources: ['arn:aws:s3:::beta-resume-tako-tw-website', 'arn:aws:s3:::beta-resume-tako-tw-website/*'],
            }),
            new iam.PolicyStatement({
              actions: ['cloudfront:CreateInvalidation'],
              resources: ['*'],
            }),
          ],
        }),
      ],
    });

    // Manual approval before Prod
    const prodStage = new WebsiteDeployStage(this, 'Prod', {
      domainName: props.domainName,
      stage: 'prod',
      env: {
        account: this.account,
        region: 'us-east-1',
      },
    });
    pipeline.addStage(prodStage, {
      pre: [
        new pipelines.ManualApprovalStep('PromoteToProd', {
          comment: 'Check beta.resume.tako.tw before promoting to production',
        }),
      ],
      post: [
        new pipelines.CodeBuildStep('DeployWebsiteContent', {
          input: source,
          envFromCfnOutputs: {
            BUCKET_NAME: prodStage.websiteStack.bucketNameOutput,
            DISTRIBUTION_ID: prodStage.websiteStack.distributionIdOutput,
          },
          commands: [
            'aws s3 sync website/ s3://$BUCKET_NAME/ --delete',
            'aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths "/*"',
          ],
          rolePolicyStatements: [
            new iam.PolicyStatement({
              actions: ['s3:ListBucket', 's3:GetObject', 's3:PutObject', 's3:DeleteObject'],
              resources: ['arn:aws:s3:::resume-tako-tw-website', 'arn:aws:s3:::resume-tako-tw-website/*'],
            }),
            new iam.PolicyStatement({
              actions: ['cloudfront:CreateInvalidation'],
              resources: ['*'],
            }),
          ],
        }),
      ],
    });

    // Note: Pipeline console URL will be available after first deployment
    // Check AWS Console: CodePipeline → ResumeWebsitePipeline
  }
}
