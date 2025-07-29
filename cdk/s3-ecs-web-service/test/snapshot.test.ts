import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { GlobalStack } from "../lib/global-stack";
import { MainStack } from "../lib/main-stack";
// dev.tsのパラメータをインポート
import { params } from "../params/dev";

const app = new App();

// GlobalStackを作成（バージニアリージョン）
const globalStack = new GlobalStack(
  app,
  "TestGlobalStack",
  params.globalStackProps,
);

// MainStackを作成（東京リージョン）
const mainStack = new MainStack(app, "TestMainStack", {
  ...params.mainStackProps,
  cloudfrontCertificate: globalStack.cloudfrontCertificate,
  cloudFrontWebAcl: globalStack.cloudFrontWebAcl,
});

describe("スナップショットテスト", () => {
  test("GlobalStack スナップショットテスト", () => {
    const template = Template.fromStack(globalStack);
    expect(template.toJSON()).toMatchSnapshot();
  });

  test("MainStack スナップショットテスト", () => {
    const template = Template.fromStack(mainStack);
    expect(template.toJSON()).toMatchSnapshot();
  });
});
