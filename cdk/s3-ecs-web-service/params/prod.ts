import * as cdk from "aws-cdk-lib";
import type { GlobalStackProps, MainStackProps, Params } from "../types/params";

// TODO: 本番環境のパラメータを定義する

// 開発段階では、dev環境のパラメータをコピーして本番環境のパラメータを定義する
import { params as devParams } from "./dev";
export const params = devParams;
