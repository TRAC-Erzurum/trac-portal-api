import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
  Req,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { Operator } from '../entities/operator.entity';
import { GlobalRole, BranchRole } from '../../auth/enums/role.enum';
import { Roles } from '../../auth/decorators/roles.decorator';
import {
  OperatorService,
  OperatorStats,
  OperatorNetItem,
  OperatorSearchResult,
} from '../services/operator.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { OperatorDto } from '../dto/operator.dto';
import { CsvParserService } from '../services/csv-parser.service';
import { OperatorQueryDto } from '../dto/operator-query.dto';
import { RequestWithUser } from '../../shared/types/request.types';
import { Express } from 'express';
import { PortalOrBranchLeaderGuard } from '../../branch/guards/portal-or-branch-leader.guard';
import { MembershipService } from '../../branch/services/membership.service';

@Controller('operator')
export class OperatorController {
  constructor(
    private readonly operatorService: OperatorService,
    private readonly csvParserService: CsvParserService,
    private readonly membershipService: MembershipService,
  ) {}

  @Get()
  @Roles(BranchRole.VOLUNTEER)
  getOperators(
    @Query() query: OperatorQueryDto,
    @Req() req: RequestWithUser,
  ) {
    return this.operatorService.findWithStats(query, req.user?.id);
  }

  @Get('user')
  @Roles(BranchRole.VOLUNTEER)
  getOperatorsWithUser(@Req() req: RequestWithUser): Promise<Operator[]> {
    return this.operatorService.findAllWithUser(req.user?.id);
  }

  @Get('search')
  @Roles(BranchRole.VOLUNTEER)
  searchOperators(
    @Query('q') query: string,
    @Query('sortBy') sortBy?: 'managed' | 'attended' | 'default',
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit?: number,
    @Query('priorityBranchId') priorityBranchId?: string,
    @Req() req?: RequestWithUser,
  ): Promise<OperatorSearchResult[]> {
    return this.operatorService.search(
      query,
      sortBy || 'default',
      Math.min(limit, 50),
      priorityBranchId,
      req?.user?.id,
    );
  }

  @Get(':operatorId/memberships')
  @Roles(BranchRole.VOLUNTEER)
  getOperatorMemberships(@Param('operatorId') operatorId: string) {
    return this.membershipService.getMembershipsForOperator(operatorId);
  }

  @Get(':id')
  @Roles(BranchRole.VOLUNTEER)
  getOperator(@Param('id') id: string): Promise<Operator> {
    return this.operatorService.findOne(id);
  }

  @Get(':id/stats')
  @Roles(BranchRole.VOLUNTEER)
  getOperatorStats(@Param('id') id: string): Promise<OperatorStats> {
    return this.operatorService.getStats(id);
  }

  @Get(':id/recent-nets')
  @Roles(BranchRole.VOLUNTEER)
  getOperatorRecentNets(
    @Param('id') id: string,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('branchId') branchId?: string,
  ): Promise<OperatorNetItem[]> {
    return this.operatorService.getRecentNets(
      id,
      Math.min(limit, 50),
      offset,
      branchId,
    );
  }

  @Get(':id/certificates')
  @Roles(BranchRole.VOLUNTEER)
  getOperatorCertificates(@Param('id') id: string) {
    return this.operatorService.getCertificates(id);
  }

  @Post('import')
  @UseGuards(PortalOrBranchLeaderGuard)
  @Roles(GlobalRole.GUEST)
  @UseInterceptors(FileInterceptor('file'))
  async importOperators(
    @UploadedFile() file: Express.Multer.File,
    @Body('mapping') mapping: string,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    const columnMapping = JSON.parse(mapping) as Record<string, string>;
    const operators = await this.csvParserService.parse(
      file.buffer,
      columnMapping,
    );
    await this.operatorService.import(operators, req.user.email);
  }

  @Delete(':id')
  @UseGuards(PortalOrBranchLeaderGuard)
  @Roles(GlobalRole.GUEST)
  async deleteOperator(@Param('id') id: string): Promise<void> {
    await this.operatorService.delete(id);
  }

  @Patch(':id')
  @UseGuards(PortalOrBranchLeaderGuard)
  @Roles(GlobalRole.GUEST)
  async updateOperator(
    @Param('id') id: string,
    @Body() dto: OperatorDto,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    await this.operatorService.update(id, dto, req.user.email);
  }
}
