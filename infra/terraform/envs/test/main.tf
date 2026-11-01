module "platform" {
  source = "../../modules/platform"

  environment = "test"
  name_prefix = "fable-test"
}

output "environment" {
  value = module.platform.environment
}

output "intended_services" {
  value = module.platform.intended_services
}
