import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { UserService } from '../services/user.service';
import { CurrentUser } from '../decorators/current-user.decorator';
import { ICurrentUser } from '../types/user.types';
import { Role } from '../../auth/enums/role.enum';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CreateOperatorDto } from '../dto/create-operator.dto';
import { AllowWithoutCallsign } from '../../auth/decorators/allow-without-callsign.decorator';
import { UpdateOperatorDto } from '../dto/update-operator.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { SetPasswordDto } from '../dto/set-password.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { unlink } from 'fs/promises';
import { Express } from 'express';

@Controller('user')
@Roles(Role.GUEST)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('profile')
  @AllowWithoutCallsign()
  async profile(@CurrentUser() user: ICurrentUser) {
    return this.userService.findOne(user.id);
  }

  @Post('operator')
  @AllowWithoutCallsign()
  async createOperator(
    @CurrentUser() user: ICurrentUser,
    @Body() createOperatorDto: CreateOperatorDto,
  ) {
    return this.userService.createOperator(user.id, createOperatorDto);
  }

  @Patch('operator')
  async updateOperator(
    @CurrentUser() user: ICurrentUser,
    @Body() dto: UpdateOperatorDto,
  ) {
    return this.userService.updateOperator(user.id, dto);
  }

  @Get('operator')
  async getOperatorOfUser(@CurrentUser() user: ICurrentUser) {
    return this.userService.getOperatorOfUser(user.id);
  }

  @Patch()
  async updateUser(
    @CurrentUser() user: ICurrentUser,
    @Body() dto: UpdateUserDto,
  ) {
    return this.userService.updateUser(user.id, dto);
  }

  @Post('change-password')
  async changePassword(
    @CurrentUser() user: ICurrentUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.userService.changePassword(user.id, dto);
  }

  @Post('set-password')
  async setPassword(
    @CurrentUser() user: ICurrentUser,
    @Body() dto: SetPasswordDto,
  ) {
    return this.userService.setPassword(user.id, dto);
  }

  @Get(':id')
  @Roles(Role.VOLUNTEER)
  async getUser(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (_req, file, callback) => {
          console.log('Processing file:', {
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            fieldname: file.fieldname,
            buffer: !!file.buffer,
          });
          const uniqueName = crypto.randomUUID();
          callback(null, `${uniqueName}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (_req, file, callback) => {
        console.log('Filtering file:', {
          originalname: file.originalname,
          mimetype: file.mimetype,
          fieldname: file.fieldname,
        });
        if (!file.originalname.match(/\.(jpg|jpeg|png|webp)$/i)) {
          console.log('File rejected: invalid extension');
          return callback(
            new BadRequestException('Only image files are allowed!'),
            false,
          );
        }
        console.log('File accepted');
        callback(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  )
  async uploadProfilePicture(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: ICurrentUser,
  ) {
    if (!file) {
      console.log('No file received');
      throw new BadRequestException('No file uploaded');
    }

    try {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
        console.log('Invalid mimetype:', file.mimetype);
        await unlink(file.path);
        throw new BadRequestException('Invalid file type');
      }

      await this.userService.updateUser(user.id, {
        picture: `/uploads/${file.filename}`,
      });

      console.log('File successfully processed, returning URL');
      return { url: `/uploads/${file.filename}` };
    } catch (error) {
      console.error('Error processing upload:', error);
      if (file.path) {
        await unlink(file.path).catch(() => {});
      }
      throw new BadRequestException('Error processing file');
    }
  }

  @Patch(':id/role')
  @Roles(Role.ADMIN)
  async updateUserRole(@Param('id') id: string, @Body('role') role: Role) {
    return this.userService.updateUserRole(id, role);
  }

  @Get(':id/operator')
  @Roles(Role.ADMIN)
  async getOperatorByUserId(@Param('id') id: string) {
    return this.userService.getOperatorOfUser(id);
  }

  @Patch(':id/operator')
  @Roles(Role.ADMIN)
  async updateOperatorByUserId(
    @Param('id') id: string,
    @Body() dto: UpdateOperatorDto,
  ) {
    return this.userService.updateOperator(id, dto);
  }
}
