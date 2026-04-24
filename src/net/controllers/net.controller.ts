import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  Sse,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import type { Observable } from 'rxjs';
import { NetService } from '../services/net.service';
import { CertificateService } from '../services/certificate.service';
import { ReportShareService } from '../services/report-share.service';
import { Public } from '../../auth/decorators/public.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { GlobalRole, BranchRole } from '../../auth/enums/role.enum';
import {
  ManageNet,
  ManageNetDeleteLeadershipOnly,
} from '../decorators/manage-net.decorator';
import { ManageNetGuard } from '../guards/manage-net.guard';
import { UpdateNetDto } from '../dto/update-net.dto';
import { StartNetDto } from '../dto/start-net.dto';
import { NetQueryDto } from '../dto/net-query.dto';
import { RequestWithUser } from '../../shared/types/request.types';

@Controller('net')
@UseGuards(ManageNetGuard)
export class NetController {
  constructor(
    private readonly netService: NetService,
    private readonly certificateService: CertificateService,
    private readonly reportShareService: ReportShareService,
  ) {}

  @Put(':id')
  @Roles(BranchRole.MEMBER)
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
  @Roles(BranchRole.VOLUNTEER)
  @ManageNet('id')
  @ManageNetDeleteLeadershipOnly()
  deleteNet(@Param('id') id: string) {
    return this.netService.delete(id);
  }

  @Get()
  findAll(@Query() query: NetQueryDto, @Req() req: RequestWithUser) {
    return this.netService.findAll(query, req.user.id);
  }

  @Sse('report/share/sse')
  @Roles(BranchRole.MEMBER)
  reportShareConsumedStream(): Observable<{ data: { token: string } }> {
    return this.reportShareService.getConsumedTokenStream();
  }

  @Get('report/share/:token')
  @Public()
  async getReportShare(@Param('token') token: string) {
    return this.reportShareService.getReportDataAndConsume(token);
  }

  @Post(':id/report/share')
  @Roles(BranchRole.MEMBER)
  async createReportShare(@Param('id') id: string): Promise<{ token: string }> {
    await this.netService.findOne(id);
    const token = await this.reportShareService.createToken(id);
    return { token };
  }

  @Get(':id/certificate/preview')
  @Roles(BranchRole.VOLUNTEER)
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
  @Roles(BranchRole.VOLUNTEER)
  @ManageNet('id')
  async downloadAllCertificates(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ) {
    await this.certificateService.generateAllPdfs(id, req.user.id, res);
  }

  @Get(':id/certificate/can-download-others')
  @Roles(BranchRole.VOLUNTEER)
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
  @Roles(BranchRole.VOLUNTEER)
  async getCertificatePreviewData(
    @Param('id') id: string,
    @Param('attendeeId') attendeeId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.certificateService.getPreviewData(
      id,
      attendeeId,
      req.user.id,
      req.user.callSign,
    );
  }

  @Get(':id/certificate/:attendeeId')
  @Roles(BranchRole.VOLUNTEER)
  async getCertificate(
    @Param('id') id: string,
    @Param('attendeeId') attendeeId: string,
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ) {
    await this.certificateService.generatePdf(
      id,
      attendeeId,
      req.user.id,
      req.user.callSign,
      res,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.netService.findOne(id);
  }

  @Patch(':id/start')
  @Roles(BranchRole.VOLUNTEER)
  @ManageNet('id')
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
  @Roles(BranchRole.VOLUNTEER)
  @ManageNet('id')
  async endNet(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.netService.endNet(id, req.user.email, req.user.callSign);
  }

  @Patch(':id/operator')
  @Roles(BranchRole.VOLUNTEER)
  @ManageNet('id')
  changeOperator(
    @Param('id') id: string,
    @Body('operatorId') operatorId: string,
    @Req() req: RequestWithUser,
  ) {
    const isSuperAdmin = req.user.role === GlobalRole.SUPER_ADMIN;
    return this.netService.changeOperator(
      id,
      operatorId,
      req.user.email,
      isSuperAdmin,
    );
  }
}
