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
} from '@nestjs/common';
import { Operator } from '../entities/operator.entity';
import { Role } from '../../auth/enums/role.enum';
import { Roles } from '../../auth/decorators/roles.decorator';
import { OperatorService } from '../services/operator.service';
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
    return this.operatorService.find(query);
  }

  @Get('user')
  @Roles(Role.VOLUNTEER)
  getOperatorsWithUser(): Promise<Operator[]> {
    return this.operatorService.findAllWithUser();
  }

  @Get('search')
  @Roles(Role.VOLUNTEER)
  searchOperators(@Query('q') query: string): Promise<Operator[]> {
    return this.operatorService.search(query);
  }

  @Get(':id')
  @Roles(Role.VOLUNTEER)
  getOperator(@Param('id') id: string): Promise<Operator> {
    return this.operatorService.findOne(id);
  }

  @Post('import')
  @Roles(Role.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  async importOperators(
    @UploadedFile() file: Express.Multer.File,
    @Body('mapping') mapping: string,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    const columnMapping = JSON.parse(mapping);
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
