import { Global, Module } from '@nestjs/common';
import { R2Service } from './r2.service';
import { FileStorageService } from './file-storage.service';

@Global()
@Module({
  providers: [R2Service, FileStorageService],
  exports: [R2Service, FileStorageService],
})
export class StorageModule {}
