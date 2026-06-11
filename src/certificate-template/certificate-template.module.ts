import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CertificateTemplate } from './entities/certificate-template.entity';
import { CertificateTemplateService } from './certificate-template.service';
import { CertificateTemplateController } from './certificate-template.controller';
import { BranchModule } from '../branch/branch.module';
import { Net } from '../net/entities/net.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CertificateTemplate, Net]), BranchModule],
  controllers: [CertificateTemplateController],
  providers: [CertificateTemplateService],
  exports: [CertificateTemplateService],
})
export class CertificateTemplateModule {}
