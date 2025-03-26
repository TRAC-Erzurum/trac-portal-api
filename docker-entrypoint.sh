#!/bin/sh

echo "Running database migrations..."
node dist/config/run-migrations.js
MIGRATION_EXIT_CODE=$?

if [ $MIGRATION_EXIT_CODE -ne 0 ]; then
    echo "Migration failed! Application will not start."
    exit $MIGRATION_EXIT_CODE
fi

echo "Starting the application with PM2..."
exec pm2-runtime start ecosystem.config.js 