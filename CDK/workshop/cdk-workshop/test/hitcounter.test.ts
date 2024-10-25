import {Stack} from "aws-cdk-lib";
import {Template, Capture} from "aws-cdk-lib/assertions";
import {Code, Function as LambdaFunction, Runtime} from "aws-cdk-lib/aws-lambda";
import {HitCounter} from "../lib/hitcounter";

// 共通のダウンストリームLambda関数を作成する関数
const createTestLambdaFunction = (stack: Stack): LambdaFunction =>
    new LambdaFunction(stack, "TestFunction", {
        runtime: Runtime.NODEJS_18_X,
        handler: "hello.handler",
        code: Code.fromAsset("lambda"),
    });

// 各テストケース
describe('HitCounter', () => {
    let stack: Stack;
    let testLambdaFunction: LambdaFunction;

    // 各テストケースの前に実行される
    beforeEach(() => {
        stack = new Stack();
        testLambdaFunction = createTestLambdaFunction(stack);
    });

    test("DynamoDB Table Created With Encryption", () => {
        new HitCounter(stack, "MyTestConstruct", {
            downstream: testLambdaFunction,
        });

        const template = Template.fromStack(stack);
        template.hasResourceProperties("AWS::DynamoDB::Table", {
            SSESpecification: {
                SSEEnabled: true,
            },
        });
    });

    test("read capacity can be configured", () => {
        expect(() => {
            new HitCounter(stack, "MyTestConstruct", {
                downstream: testLambdaFunction,
                readCapacity: 3,
            });
        }).toThrow(/readCapacity must be greater than 5 and less than 20/);
    });

    test("Lambda Has Environment Variables", () => {
        new HitCounter(stack, "MyTestConstruct", {
            downstream: testLambdaFunction,
        });

        const template = Template.fromStack(stack);
        const envCapture = new Capture();
        template.hasResourceProperties("AWS::Lambda::Function", {
            Environment: envCapture,
        });

        expect(envCapture.asObject()).toEqual({
            Variables: {
                DOWNSTREAM_FUNCTION_NAME: {
                    Ref: "TestFunction22AD90FC",
                },
                HITS_TABLE_NAME: {
                    Ref: "MyTestConstructHits24A357F0",
                },
            },
        });
    });
});
