import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateUserPlatformDto } from './dto/create-user-platform.dto';
import { User } from './entities/user.entity';
import { UserPlatform, Platform } from './entities/user-platform.entity';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new user' })
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({
    status: 201,
    description: 'User created successfully',
    type: User,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 409, description: 'Email or referral code already exists' })
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all users' })
  @ApiResponse({
    status: 200,
    description: 'List of users',
    type: [User],
  })
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user by ID' })
  @ApiParam({ name: 'id', description: 'User ID', type: Number })
  @ApiResponse({
    status: 200,
    description: 'User found',
    type: User,
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a user' })
  @ApiParam({ name: 'id', description: 'User ID', type: Number })
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({
    status: 200,
    description: 'User updated successfully',
    type: User,
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'Email or referral code already exists' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a user' })
  @ApiParam({ name: 'id', description: 'User ID', type: Number })
  @ApiResponse({ status: 204, description: 'User deleted successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.remove(id);
  }

  @Post(':id/platforms')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Link a platform to a user' })
  @ApiParam({ name: 'id', description: 'User ID', type: Number })
  @ApiBody({ type: CreateUserPlatformDto })
  @ApiResponse({
    status: 201,
    description: 'Platform linked successfully',
    type: UserPlatform,
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'Platform already linked' })
  linkPlatform(
    @Param('id', ParseIntPipe) id: number,
    @Body() createPlatformDto: CreateUserPlatformDto,
  ) {
    return this.usersService.linkPlatform(id, createPlatformDto);
  }

  @Get(':id/platforms')
  @ApiOperation({ summary: 'Get all platforms linked to a user' })
  @ApiParam({ name: 'id', description: 'User ID', type: Number })
  @ApiResponse({
    status: 200,
    description: 'List of user platforms',
    type: [UserPlatform],
  })
  getUserPlatforms(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.getUserPlatforms(id);
  }

  @Delete(':id/platforms/:platform')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unlink a platform from a user' })
  @ApiParam({ name: 'id', description: 'User ID', type: Number })
  @ApiParam({ name: 'platform', enum: Platform, description: 'Platform type' })
  @ApiResponse({ status: 204, description: 'Platform unlinked successfully' })
  @ApiResponse({ status: 404, description: 'User or platform link not found' })
  unlinkPlatform(
    @Param('id', ParseIntPipe) id: number,
    @Param('platform') platform: Platform,
  ) {
    return this.usersService.unlinkPlatform(id, platform);
  }
}
