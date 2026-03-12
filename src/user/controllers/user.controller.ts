import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Req,
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
import { AdminResetPasswordDto } from '../dto/admin-reset-password.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import { RequestWithUser } from '../../shared/types/request.types';
import { UpdateCurrentBranchDto } from '../dto/update-current-branch.dto';
import { AuthService } from '../../auth/services/auth.service';
import { ConfigService } from '@nestjs/config';
import { FileStorageService } from '../../shared/storage';
import { MAX_UPLOAD_BYTES } from '../../shared/constants/upload.constants';

@Controller('user')
@Roles(Role.GUEST)
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly fileStorage: FileStorageService,
  ) {}

  @Get('profile')
  @AllowWithoutCallsign()
  async profile(@CurrentUser() user: ICurrentUser) {
    return this.userService.findOne(user.id, user);
  }

  @Post('operator')
  @AllowWithoutCallsign()
  async createOperator(
    @CurrentUser() user: ICurrentUser,
    @Body() createOperatorDto: CreateOperatorDto,
    @Req() req: RequestWithUser,
  ) {
    return this.userService.createOperator(
      user.id,
      createOperatorDto,
      req.user.email,
    );
  }

  @Patch('operator')
  async updateOperator(
    @CurrentUser() user: ICurrentUser,
    @Body() dto: UpdateOperatorDto,
    @Req() req: RequestWithUser,
  ) {
    return this.userService.updateOperator(user.id, dto, req.user.email);
  }

  @Get('operator')
  async getOperatorOfUser(@CurrentUser() user: ICurrentUser) {
    return this.userService.getOperatorOfUser(user.id);
  }

  @Patch()
  async updateUser(
    @CurrentUser() user: ICurrentUser,
    @Body() dto: UpdateUserDto,
    @Req() req: RequestWithUser,
  ) {
    return this.userService.updateUser(user.id, dto, req.user.email);
  }

  @Post('change-password')
  async changePassword(
    @CurrentUser() user: ICurrentUser,
    @Body() dto: ChangePasswordDto,
    @Req() req: RequestWithUser,
  ) {
    return this.userService.changePassword(user.id, dto, req.user.email);
  }

  @Post('set-password')
  async setPassword(
    @CurrentUser() user: ICurrentUser,
    @Body() dto: SetPasswordDto,
    @Req() req: RequestWithUser,
  ) {
    return this.userService.setPassword(user.id, dto, req.user.email);
  }

  @Get(':id')
  @Roles(Role.VOLUNTEER)
  async getUser(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    return this.userService.findOne(id, user);
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      fileFilter: (_req, file, callback) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png|webp)$/i)) {
          return callback(
            new BadRequestException('Only image files are allowed!'),
            false,
          );
        }
        callback(null, true);
      },
      limits: { fileSize: MAX_UPLOAD_BYTES },
    }),
  )
  async uploadProfilePicture(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: ICurrentUser,
    @Req() req: RequestWithUser,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type');
    }
    const filename = `${crypto.randomUUID()}${extname(file.originalname)}`;
    const logicalPath = `uploads/${filename}`;
    await this.fileStorage.putBytes(logicalPath, file.buffer, file.mimetype);
    await this.userService.updateUser(
      user.id,
      { picture: `/uploads/${filename}` },
      req.user.email,
    );
    return { url: `/uploads/${filename}` };
  }

  @Delete('picture')
  async deleteProfilePicture(
    @CurrentUser() user: ICurrentUser,
    @Req() req: RequestWithUser,
  ) {
    const currentUser = await this.userService.findOne(user.id);
    if (currentUser.picture && currentUser.picture.startsWith('/uploads/')) {
      const logicalPath = currentUser.picture.replace(/^\//, '');
      await this.fileStorage.delete(logicalPath);
    }
    await this.userService.updateUser(
      user.id,
      { picture: null },
      req.user.email,
    );
    return { message: 'Picture deleted' };
  }

  @Patch(':id/role')
  @Roles(Role.ADMIN)
  async updateUserRole(
    @Param('id') id: string,
    @Body('role') role: Role,
    @Req() req: RequestWithUser,
  ) {
    return this.userService.updateUserRole(id, role, req.user.email);
  }

  @Post(':id/reset-password')
  @Roles(Role.ADMIN)
  async adminResetPassword(
    @Param('id') id: string,
    @Body() dto: AdminResetPasswordDto,
    @Req() req: RequestWithUser,
  ) {
    return this.userService.adminResetPassword(id, dto.newPassword, req.user);
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
    @Req() req: RequestWithUser,
  ) {
    return this.userService.updateOperator(id, dto, req.user.email);
  }

  @Patch('me/current-branch')
  async updateCurrentBranch(
    @CurrentUser() user: ICurrentUser,
    @Body() dto: UpdateCurrentBranchDto,
  ) {
    await this.userService.updateCurrentBranch(user.id, dto.branchId);
    return { success: true };
  }
}
