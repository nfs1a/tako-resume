import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface PipelineStackProps extends cdk.StackProps {
  websiteBucket: s3.IBucket;
  distribution: cloudfront.IDistribution;
  githubOwner: string;
  githubRepo: string;
  githubBranch: string;
}

export class PipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);

    // Artifact bucket for pipeline
    const artifactBucket = new s3.Bucket(this, 'ArtifactBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    // Source artifact
    const sourceOutput = new codepipeline.Artifact('SourceOutput');
    const buildOutput = new codepipeline.Artifact('BuildOutput');

    // CodeBuild project for building and deploying
    const buildProject = new codebuild.PipelineProject(this, 'BuildProject', {
      projectName: 'ResumeWebsiteBuild',
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.SMALL,
      },
      environmentVariables: {
        WEBSITE_BUCKET: { value: props.websiteBucket.bucketName },
        DISTRIBUTION_ID: { value: props.distribution.distributionId },
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            'runtime-versions': {
              nodejs: '20',
            },
          },
          build: {
            commands: [
              'echo "Building website..."',
              'ls -la',
              'ls -la website/ || echo "No website folder, using root"',
            ],
          },
          post_build: {
            commands: [
              'echo "Deploying to S3..."',
              // Sync website folder if exists, otherwise sync from root (excluding infra)
              'if [ -d "website" ]; then aws s3 sync website/ s3://$WEBSITE_BUCKET --delete; else aws s3 sync . s3://$WEBSITE_BUCKET --delete --exclude "infra/*" --exclude ".git/*" --exclude "*.md" --exclude "buildspec.yml"; fi',
              'echo "Invalidating CloudFront cache..."',
              'aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths "/*"',
            ],
          },
        },
        artifacts: {
          'base-directory': '.',
          files: ['**/*'],
        },
      }),
    });

    // Grant permissions to CodeBuild
    props.websiteBucket.grantReadWrite(buildProject);

    buildProject.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['cloudfront:CreateInvalidation'],
      resources: [`arn:aws:cloudfront::${this.account}:distribution/${props.distribution.distributionId}`],
    }));

    // CodePipeline
    const pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
      pipelineName: 'ResumeWebsitePipeline',
      artifactBucket: artifactBucket,
      pipelineType: codepipeline.PipelineType.V2,
      stages: [
        {
          stageName: 'Source',
          actions: [
            new codepipeline_actions.CodeStarConnectionsSourceAction({
              actionName: 'GitHub_Source',
              owner: props.githubOwner,
              repo: props.githubRepo,
              branch: props.githubBranch,
              output: sourceOutput,
              // You need to create this connection in AWS Console first
              connectionArn: `arn:aws:codeconnections:${this.region}:${this.account}:connection/810c6cd2-410a-4d95-897b-1d54a19f02d6`,
              triggerOnPush: true,
            }),
          ],
        },
        {
          stageName: 'Build_and_Deploy',
          actions: [
            new codepipeline_actions.CodeBuildAction({
              actionName: 'Build_and_Deploy',
              project: buildProject,
              input: sourceOutput,
              outputs: [buildOutput],
            }),
          ],
        },
      ],
    });

    // Outputs
    new cdk.CfnOutput(this, 'PipelineName', {
      value: pipeline.pipelineName,
      description: 'CodePipeline Name',
    });

    new cdk.CfnOutput(this, 'PipelineArn', {
      value: pipeline.pipelineArn,
      description: 'CodePipeline ARN',
    });
  }
}
