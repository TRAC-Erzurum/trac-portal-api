import dataSource from './typeorm.config';

async function runMigrations() {
  try {
    await dataSource.initialize();
    const pendingMigrations = await dataSource.showMigrations();

    if (pendingMigrations) {
      console.log('Running pending migrations...');
      await dataSource.runMigrations({
        transaction: 'each',
      });
      console.log('Migrations completed successfully');
    } else {
      console.log('No pending migrations');
    }

    await dataSource.destroy();
  } catch (error) {
    console.error('Error running migrations:', error);
    await dataSource.destroy();
    process.exit(1);
  }
}

runMigrations().catch((error) => {
  console.error('Unhandled error in migrations:', error);
  process.exit(1);
});
