provider "google" {
  project = var.project
  region  = "europe-west1"
}

resource "google_cloud_run_v2_service" "api" {
  name     = "api"
  location = "europe-west1"
  template {
    containers {
      image = "europe-west1-docker.pkg.dev/${var.project}/app/api"
    }
  }
}

resource "google_sql_database_instance" "main" {
  name             = "main"
  database_version = "POSTGRES_16"
  settings {
    tier = "db-f1-micro"
  }
}

resource "google_storage_bucket" "uploads" {
  name     = "${var.project}-uploads"
  location = "EU"
}

resource "google_pubsub_topic" "orders" {
  name = "orders"
}

# resource "google_redis_instance" "cache" {}
