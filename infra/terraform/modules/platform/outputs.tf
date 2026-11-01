output "environment" {
  value       = var.environment
  description = "The environment name passed in by the env root."
}

output "name_prefix" {
  value       = var.name_prefix
  description = "Naming prefix reserved for a future live stack."
}

output "intended_services" {
  value       = local.intended_services
  description = "Services this foundation expects. None of them are provisioned by Terraform yet."
}
