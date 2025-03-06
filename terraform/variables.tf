variable "aws_region" {
  type        = string
  default     = "eu-central-1"
  description = "AWS region where resources will be deployed"
}

variable "feature_name" {
  type        = string
  default     = "dev"
  description = "Used to uniquely name resources for ephemeral environments (e.g., 'feature-test')"
}
