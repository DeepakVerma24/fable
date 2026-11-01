module "platform" {
  source = "../../modules/platform"

  environment = "dev"
  name_prefix = "fable-dev"
}

output "environment" {
  value = module.platform.environment
}

output "intended_services" {
  value = module.platform.intended_services
}
