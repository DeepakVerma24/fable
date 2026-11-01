module "platform" {
  source = "../../modules/platform"

  environment = "prod"
  name_prefix = "fable-prod"
}

output "environment" {
  value = module.platform.environment
}

output "intended_services" {
  value = module.platform.intended_services
}
