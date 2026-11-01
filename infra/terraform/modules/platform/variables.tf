variable "environment" {
  type        = string
  description = "Deployment name: dev, test, or prod. This skeleton does not apply cloud resources."

  validation {
    condition     = contains(["dev", "test", "prod"], var.environment)
    error_message = "environment must be dev, test, or prod."
  }
}

variable "name_prefix" {
  type        = string
  description = "Short prefix for future resource names. No resources are created by this module yet."
}
