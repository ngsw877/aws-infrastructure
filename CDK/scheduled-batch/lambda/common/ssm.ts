import {
  GetParameterCommand,
  PutParameterCommand,
  SSMClient,
} from "@aws-sdk/client-ssm";

const ssmClient = new SSMClient({ region: process.env.AWS_REGION });

/**
 * パラメータストアの値を取得する
 * @param parameterName
 */
export const getParameterStoreValue = async (
  parameterName: string,
): Promise<string> => {
  const command = new GetParameterCommand({
    Name: parameterName,
    WithDecryption: true,
  });
  const response = await ssmClient.send(command);
  return response.Parameter?.Value || "";
};

/**
 * パラメータストアに値を保存
 * @param parameterName
 * @param value
 */
export const updateParameterStoreValue = async (
  parameterName: string,
  value: string,
): Promise<void> => {
  const putCommand = new PutParameterCommand({
    Name: parameterName,
    Value: value,
    Type: "SecureString",
    Overwrite: true,
  });

  await ssmClient.send(putCommand);
};
