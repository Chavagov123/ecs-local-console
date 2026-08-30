import {
  DescribeSecurityGroupsCommand,
  DescribeSubnetsCommand,
  DescribeVpcsCommand,
  EC2Client,
} from "@aws-sdk/client-ec2";
import { IAMClient, ListRolesCommand } from "@aws-sdk/client-iam";
import { mockClient } from "aws-sdk-client-mock";
import type { FastifyInstance } from "fastify";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";

const ec2Mock = mockClient(EC2Client);
const iamMock = mockClient(IAMClient);
let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp({ env: { AWS_ENDPOINT_URL: "http://localhost:4566", PORT: "0" } });
});
afterAll(async () => {
  await app.close();
});
afterEach(() => {
  ec2Mock.reset();
  iamMock.reset();
  app.cache.invalidate();
});

describe("networking", () => {
  it("lists subnets with AZ + name tag", async () => {
    ec2Mock.on(DescribeSubnetsCommand).resolves({
      Subnets: [
        {
          SubnetId: "subnet-1",
          VpcId: "vpc-1",
          CidrBlock: "10.0.1.0/24",
          AvailabilityZone: "us-east-1a",
          MapPublicIpOnLaunch: true,
          Tags: [{ Key: "Name", Value: "public-a" }],
        },
      ],
    });
    const res = await app.inject({ method: "GET", url: "/api/networking/subnets" });
    expect(res.statusCode).toBe(200);
    expect(res.json()[0]).toMatchObject({
      subnetId: "subnet-1",
      availabilityZone: "us-east-1a",
      mapPublicIpOnLaunch: true,
      name: "public-a",
    });
  });

  it("filters subnets by vpcId", async () => {
    ec2Mock.on(DescribeSubnetsCommand).resolves({ Subnets: [] });
    await app.inject({ method: "GET", url: "/api/networking/subnets?vpcId=vpc-9" });
    expect(ec2Mock.commandCalls(DescribeSubnetsCommand)[0]!.args[0].input).toMatchObject({
      Filters: [{ Name: "vpc-id", Values: ["vpc-9"] }],
    });
  });

  it("lists security groups", async () => {
    ec2Mock.on(DescribeSecurityGroupsCommand).resolves({
      SecurityGroups: [{ GroupId: "sg-1", GroupName: "default", VpcId: "vpc-1" }],
    });
    const res = await app.inject({ method: "GET", url: "/api/networking/security-groups" });
    expect(res.json()[0]).toMatchObject({ groupId: "sg-1", groupName: "default" });
  });

  it("puts the default VPC first", async () => {
    ec2Mock.on(DescribeVpcsCommand).resolves({
      Vpcs: [
        { VpcId: "vpc-a", IsDefault: false },
        { VpcId: "vpc-default", IsDefault: true },
      ],
    });
    const res = await app.inject({ method: "GET", url: "/api/networking/vpcs" });
    expect(res.json()[0]).toMatchObject({ vpcId: "vpc-default", isDefault: true });
  });

  it("maps a not-implemented EC2 response to 501", async () => {
    ec2Mock.on(DescribeSubnetsCommand).rejects(
      Object.assign(new Error("not implemented"), { name: "NotImplementedError" }),
    );
    const res = await app.inject({ method: "GET", url: "/api/networking/subnets" });
    expect(res.statusCode).toBe(501);
    expect(res.json().error.code).toBe("NOT_IMPLEMENTED");
  });
});

describe("iam roles", () => {
  it("classifies task / execution roles and filters by kind", async () => {
    iamMock.on(ListRolesCommand).resolves({
      Roles: [
        {
          RoleName: "ecsTaskExecutionRole",
          Arn: "arn:aws:iam::0:role/ecsTaskExecutionRole",
          Path: "/",
          AssumeRolePolicyDocument: encodeURIComponent(
            JSON.stringify({ Statement: [{ Principal: { Service: "ecs-tasks.amazonaws.com" } }] }),
          ),
        },
        {
          RoleName: "myAppTaskRole",
          Arn: "arn:aws:iam::0:role/myAppTaskRole",
          AssumeRolePolicyDocument: encodeURIComponent(
            JSON.stringify({ Statement: [{ Principal: { Service: "ecs-tasks.amazonaws.com" } }] }),
          ),
        },
        { RoleName: "unrelated", Arn: "arn:aws:iam::0:role/unrelated" },
      ],
    });
    const all = await app.inject({ method: "GET", url: "/api/iam/roles" });
    expect(all.json()).toHaveLength(3);
    const exec = await app.inject({ method: "GET", url: "/api/iam/roles?kind=execution" });
    // execution + "other" pass the filter; the pure task role is dropped
    expect(exec.json().map((r: { roleName: string }) => r.roleName)).toEqual([
      "ecsTaskExecutionRole",
      "unrelated",
    ]);
  });
});
