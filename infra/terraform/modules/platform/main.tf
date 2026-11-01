# Intentionally provider-free.
# Applying this module creates nothing. It records the shape of the platform
# so dev, test, and prod stay aligned before any cloud account is connected.
# Do not add Kubernetes, Kafka, or ClickHouse here.

locals {
  intended_services = {
    postgres  = "One PostgreSQL primary. Schema migrations connect directly."
    pgbouncer = "Connection pool in front of that same PostgreSQL. Not a second database."
    redis     = "BullMQ broker for the worker process."
    api       = "NestJS modular monolith."
    worker    = "Separate Node process. Same codebase, not a separate service mesh."
    web       = "Next.js application."
  }
}
