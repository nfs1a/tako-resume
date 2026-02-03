import * as cdk from 'aws-cdk-lib';
import * as pipelines from 'aws-cdk-lib/pipelines';
import { Construct } from 'constructs';
import { WebsiteStack, Stage as WebsiteStage } from './website-stack';

// Stage for deploying website to an environment
class WebsiteDeployStage extends cdk.Stage {
  constructor(scope: Construct, id: string, props: {
    domainName: string;
    stage: WebsiteStage;
  } & cdk.StageProps) {
    super(scope, id, props);

    new WebsiteStack(this, 'WebsiteStack', {
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

    // CDK Pipeline - self-mutating!
    const pipeline = new pipelines.CodePipeline(this, 'Pipeline', {
      pipelineName: 'ResumeWebsitePipeline',
      synth: new pipelines.ShellStep('Synth', {
        input: pipelines.CodePipelineSource.connection(
          `${props.githubOwner}/${props.githubRepo}`,
          props.githubBranch,
          {
            connectionArn: props.connectionArn,
          }
        ),
        commands: [
          'cd infra',
          'npm ci',
          'npm run build',
          'npx cdk synth',
        ],
        primaryOutputDirectory: 'infra/cdk.out',
      }),
      selfMutation: true,
    });

    // Beta Stage - deploy automatically
    pipeline.addStage(new WebsiteDeployStage(this, 'Beta', {
      domainName: props.domainName,
      stage: 'beta',
      env: {
        account: this.account,
        region: 'us-east-1',
      },
    }));

    // Prod Stage - manual approval before deploy
    pipeline.addStage(new WebsiteDeployStage(this, 'Prod', {
      domainName: props.domainName,
      stage: 'prod',
      env: {
        account: this.account,
        region: 'us-east-1',
      },
    }), {
      pre: [
        new pipelines.ManualApprovalStep('PromoteToProd', {
          comment: 'Check beta.resume.tako.tw before promoting to production',
        }),
      ],
    });
  }
}
