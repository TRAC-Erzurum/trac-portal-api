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
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { Operator } from '../entities/operator.entity';
import { Role } from '../../auth/enums/role.enum';
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

@Controller('operator')
export class OperatorController {
  constructor(
    private readonly operatorService: OperatorService,
    private readonly csvParserService: CsvParserService,
  ) {}

  @Get()
  @Roles(Role.VOLUNTEER)
  getOperators(@Query() query: OperatorQueryDto) {
    return this.operatorService.findWithStats(query);
  }

  @Get('user')
  @Roles(Role.VOLUNTEER)
  getOperatorsWithUser(): Promise<Operator[]> {
    return this.operatorService.findAllWithUser();
  }

  @Get('search')
  @Roles(Role.VOLUNTEER)
  searchOperators(
    @Query('q') query: string,
    @Query('sortBy') sortBy?: 'managed' | 'attended' | 'default',
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit?: number,
    @Query('priorityBranchId') priorityBranchId?: string,
  ): Promise<OperatorSearchResult[]> {
    return this.operatorService.search(
      query,
      sortBy || 'default',
      Math.min(limit, 50),
      priorityBranchId,
    );
  }

  @Get(':id')
  @Roles(Role.VOLUNTEER)
  getOperator(@Param('id') id: string): Promise<Operator> {
    return this.operatorService.findOne(id);
  }

  @Get(':id/stats')
  @Roles(Role.VOLUNTEER)
  getOperatorStats(@Param('id') id: string): Promise<OperatorStats> {
    return this.operatorService.getStats(id);
  }

  @Get(':id/recent-nets')
  @Roles(Role.VOLUNTEER)
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

  @Post('import')
  @Roles(Role.ADMIN)
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
  @Roles(Role.ADMIN)
  async deleteOperator(@Param('id') id: string): Promise<void> {
    await this.operatorService.delete(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  async updateOperator(
    @Param('id') id: string,
    @Body() dto: OperatorDto,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    await this.operatorService.update(id, dto, req.user.email);
  }
}
