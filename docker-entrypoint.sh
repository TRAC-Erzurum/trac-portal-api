#!/bin/sh

# Create backup directory if it doesn't exist
mkdir -p backup

# Generate backup filename with timestamp
BACKUP_TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="backup/db_backup_${BACKUP_TIMESTAMP}.sql"

echo "🗄️  Creating database backup before migrations..."
echo "📁 Backup file: $BACKUP_FILE"
echo "🔗 Database: ${DB_USERNAME}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

# Set password for pg_dump (avoid password prompt)
export PGPASSWORD=${DB_PASSWORD}

# Test database connection first
echo "🔍 Testing database connection..."
pg_isready -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USERNAME} -d ${DB_NAME}
CONNECTION_EXIT_CODE=$?

if [ $CONNECTION_EXIT_CODE -ne 0 ]; then
    echo "❌ Database connection failed! Cannot create backup."
    exit $CONNECTION_EXIT_CODE
fi

echo "✅ Database connection successful"

# Create database backup
echo "💾 Creating backup..."
pg_dump -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USERNAME} -d ${DB_NAME} > $BACKUP_FILE
BACKUP_EXIT_CODE=$?

if [ $BACKUP_EXIT_CODE -ne 0 ]; then
    echo "❌ Backup failed! Application will not start."
    rm -f $BACKUP_FILE  # Remove incomplete backup file
    exit $BACKUP_EXIT_CODE
fi

# Verify backup file was created and is not empty
if [ ! -s "$BACKUP_FILE" ]; then
    echo "❌ Backup file is empty or was not created properly!"
    rm -f $BACKUP_FILE
    exit 1
fi

BACKUP_SIZE=$(du -h $BACKUP_FILE | cut -f1)
echo "✅ Backup completed successfully: $BACKUP_FILE (${BACKUP_SIZE})"

# Clean up old backups (keep only last 2)
echo "🧹 Cleaning up old backups (keeping last 2)..."
DELETED_COUNT=$(ls -t backup/db_backup_*.sql 2>/dev/null | tail -n +3 | wc -l)
ls -t backup/db_backup_*.sql 2>/dev/null | tail -n +3 | xargs -r rm -f

if [ $DELETED_COUNT -gt 0 ]; then
    echo "🗑️  Deleted $DELETED_COUNT old backup(s)"
else
    echo "📁 No old backups to clean up"
fi

# Build project and run migrations
echo "🔄 Preparing to run database migrations..."

# In development mode, we need to build first
if [ "$NODE_ENV" = "development" ]; then
    echo "🏗️  Building project for migrations..."
    yarn build
    BUILD_EXIT_CODE=$?
    
    if [ $BUILD_EXIT_CODE -ne 0 ]; then
        echo "❌ Build failed! Cannot run migrations."
        exit $BUILD_EXIT_CODE
    fi
    echo "✅ Build completed successfully"
fi

echo "🔄 Running database migrations..."
node dist/config/run-migrations.js
MIGRATION_EXIT_CODE=$?

if [ $MIGRATION_EXIT_CODE -ne 0 ]; then
    echo "❌ Migration failed! Application will not start."
    echo "💡 Database backup is available at: $BACKUP_FILE"
    exit $MIGRATION_EXIT_CODE
fi

# Check environment and start appropriate server
if [ "$NODE_ENV" = "development" ]; then
    echo "🚀 Starting development server with yarn..."
    exec yarn start:dev
else
    echo "🚀 Starting production server with PM2..."
    exec pm2-runtime start ecosystem.config.js
fi 