import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { NetService } from '../services/net.service';
import { CertificateService } from '../services/certificate.service';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '../../auth/enums/role.enum';
import { ManageNet } from '../decorators/manage-net.decorator';
import { UpdateNetDto } from '../dto/update-net.dto';
import { StartNetDto } from '../dto/start-net.dto';
import { NetQueryDto } from '../dto/net-query.dto';
import { RequestWithUser } from '../../shared/types/request.types';

@Controller('net')
export class NetController {
  constructor(
    private readonly netService: NetService,
    private readonly certificateService: CertificateService,
  ) {}

  @Put(':id')
  @Roles(Role.MEMBER)
  updateNet(
    @Param('id') id: string,
    @Body() updateNetDto: UpdateNetDto,
    @Req() req: RequestWithUser,
  ) {
    return this.netService.update(
      id,
      updateNetDto,
      req.user.email,
      req.user.id,
    );
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  deleteNet(@Param('id') id: string) {
    return this.netService.delete(id);
  }

  @Get()
  findAll(@Query() query: NetQueryDto, @Req() req: RequestWithUser) {
    return this.netService.findAll(query, req.user.id);
  }

  @Get(':id/certificate/preview')
  @Roles(Role.MEMBER)
  async getCertificatePreview(@Param('id') id: string) {
    const net = await this.netService.findOne(id);
    if (!net.certificateTemplate) return null;
    return {
      templateId: net.certificateTemplate.id,
      imagePath: net.certificateTemplate.imagePath,
      elements: net.certificateTemplate.elements,
    };
  }

  @Get(':id/certificate/download-all')
  @Roles(Role.MEMBER)
  @ManageNet()
  async downloadAllCertificates(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ) {
    await this.certificateService.generateAllPdfs(id, req.user.id, res);
  }

  @Get(':id/certificate/can-download-others')
  @Roles(Role.MEMBER)
  async getCanDownloadOthers(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
  ) {
    const can = await this.certificateService.canDownloadAnyCertificate(
      id,
      req.user.id,
    );
    return { canDownloadOthers: can };
  }

  @Get(':id/certificate/:attendeeId/preview-data')
  @Roles(Role.MEMBER)
  async getCertificatePreviewData(
    @Param('id') id: string,
    @Param('attendeeId') attendeeId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.certificateService.getPreviewData(
      id,
      attendeeId,
      req.user.id,
    );
  }

  @Get(':id/certificate/:attendeeId')
  @Roles(Role.MEMBER)
  async getCertificate(
    @Param('id') id: string,
    @Param('attendeeId') attendeeId: string,
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ) {
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="certificate.pdf"',
    });
    await this.certificateService.generatePdf(
      id,
      attendeeId,
      req.user.id,
      res,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.netService.findOne(id);
  }

  @Patch(':id/start')
  @Roles(Role.VOLUNTEER)
  @ManageNet()
  async startNet(
    @Param('id') id: string,
    @Body() startNetDto: StartNetDto,
    @Req() req: RequestWithUser,
  ) {
    return this.netService.startNet(
      id,
      req.user.email,
      req.user.callSign,
      startNetDto.addOperatorAsAttendee,
    );
  }

  @Patch(':id/end')
  @Roles(Role.VOLUNTEER)
  @ManageNet()
  async endNet(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.netService.endNet(id, req.user.email, req.user.callSign);
  }

  @Patch(':id/restart')
  @Roles(Role.ADMIN)
  @ManageNet()
  restartNet(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.netService.restartNet(id, req.user.email);
  }

  @Patch(':id/operator')
  @Roles(Role.ADMIN)
  @ManageNet()
  changeOperator(
    @Param('id') id: string,
    @Body('operatorId') operatorId: string,
    @Req() req: RequestWithUser,
  ) {
    const isSuperAdmin = req.user.role === Role.SUPER_ADMIN;
    return this.netService.changeOperator(
      id,
      operatorId,
      req.user.email,
      isSuperAdmin,
    );
  }
}
