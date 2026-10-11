terraform {
  required_providers {
    aws = { source = "hashicorp/aws" }
  }
}

provider "aws" {
  region = "eu-west-1"
}

resource "aws_dynamodb_table" "items" {
  name         = "items"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"
  attribute {
    name = "id"
    type = "S"
  }
}

resource "aws_s3_bucket" "files" {
  bucket = "aws-serverless-app-files"
}

resource "aws_lambda_function" "api" {
  function_name = "api"
  handler       = "handler.handler"
  runtime       = "nodejs22.x"
  role          = "arn:aws:iam::123456789012:role/api"
  filename      = "dist/api.zip"
}
