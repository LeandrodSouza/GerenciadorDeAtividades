FROM postgres:15

# Official image already sets up default user/db based on environment variables
# POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB, which will be provided
# via docker-compose.

# Official image also handles data persistence at /var/lib/postgresql/data,
# which will be managed via a volume in docker-compose.

# Initialization scripts in /docker-entrypoint-initdb.d/ would be run automatically
# if added. For now, no custom scripts are needed.
