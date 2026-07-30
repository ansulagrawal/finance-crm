import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LocalDiskStorageAdapter } from './local-disk-storage.adapter';
import { S3StorageAdapter } from './s3-storage.adapter';
import { STORAGE_ADAPTER } from './storage.tokens';

/**
 * Mirrors the legacy `LMS_DOC_S3_FLAG` toggle (`application/config/constants.php`):
 * `STORAGE_DRIVER=s3` behaves like `LMS_DOC_S3_FLAG=true` (store in S3), the
 * default `local` behaves like `false` (physical/local disk store).
 */
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: STORAGE_ADAPTER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const driver = config.get<string>('STORAGE_DRIVER', 'local');
        if (driver === 's3') {
          return new S3StorageAdapter(
            config.getOrThrow<string>('AWS_S3_BUCKET'),
            config.getOrThrow<string>('AWS_REGION'),
            config.get<string>('AWS_S3_KEY_PREFIX', 'upload'),
          );
        }
        return new LocalDiskStorageAdapter(
          config.get<string>('STORAGE_LOCAL_PATH', './storage'),
          config.get<string>(
            'STORAGE_LOCAL_PUBLIC_URL',
            'http://localhost:3000/storage',
          ),
        );
      },
    },
  ],
  exports: [STORAGE_ADAPTER],
})
export class StorageModule {}
