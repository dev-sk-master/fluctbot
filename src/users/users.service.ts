import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserStatus } from './entities/user.entity';
import { UserPlatform, Platform } from './entities/user-platform.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateUserPlatformDto } from './dto/create-user-platform.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserPlatform)
    private readonly userPlatformRepository: Repository<UserPlatform>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    // Check for unique constraints
    if (createUserDto.email) {
      const existingEmail = await this.userRepository.findOne({
        where: { email: createUserDto.email },
      });
      if (existingEmail) {
        throw new ConflictException('Email already exists');
      }
    }

    if (createUserDto.referralCode) {
      const existingReferral = await this.userRepository.findOne({
        where: { referralCode: createUserDto.referralCode },
      });
      if (existingReferral) {
        throw new ConflictException('Referral code already exists');
      }
    }

    const user = this.userRepository.create({
      name: createUserDto.name,
      email: createUserDto.email,
      phoneNumber: createUserDto.phoneNumber,
      referralCode: createUserDto.referralCode,
      status: UserStatus.ACTIVE,
      emailVerified: false,
    });

    return await this.userRepository.save(user);
  }

  async findAll(): Promise<User[]> {
    return await this.userRepository.find({
      relations: ['platforms'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['platforms'],
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.userRepository.findOne({
      where: { email },
      relations: ['platforms'],
    });
  }

  async findByPlatform(
    platform: Platform,
    platformIdentifier: string,
  ): Promise<User | null> {
    const userPlatform = await this.userPlatformRepository.findOne({
      where: { platform, platformIdentifier },
      relations: ['user', 'user.platforms'],
    });

    return userPlatform?.user || null;
  }

  async update(id: number, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);

    // Check for unique constraints if updating email or referral code
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingEmail = await this.userRepository.findOne({
        where: { email: updateUserDto.email },
      });
      if (existingEmail) {
        throw new ConflictException('Email already exists');
      }
    }

    if (
      updateUserDto.referralCode &&
      updateUserDto.referralCode !== user.referralCode
    ) {
      const existingReferral = await this.userRepository.findOne({
        where: { referralCode: updateUserDto.referralCode },
      });
      if (existingReferral) {
        throw new ConflictException('Referral code already exists');
      }
    }

    Object.assign(user, updateUserDto);
    return await this.userRepository.save(user);
  }

  async remove(id: number): Promise<void> {
    const user = await this.findOne(id);
    await this.userRepository.remove(user);
  }

  async updateLastActive(id: number): Promise<void> {
    await this.userRepository.update(id, {
      lastActiveAt: new Date(),
    });
  }

  async linkPlatform(
    userId: number,
    createPlatformDto: CreateUserPlatformDto,
  ): Promise<UserPlatform> {
    const user = await this.findOne(userId);

    // Check if platform already linked to this user
    const existingLink = await this.userPlatformRepository.findOne({
      where: {
        userId,
        platform: createPlatformDto.platform,
      },
    });

    if (existingLink) {
      throw new ConflictException(
        `Platform ${createPlatformDto.platform} already linked to this user`,
      );
    }

    // Check if platform identifier is already linked to another user
    const existingIdentifier = await this.userPlatformRepository.findOne({
      where: {
        platform: createPlatformDto.platform,
        platformIdentifier: createPlatformDto.platformIdentifier,
      },
    });

    if (existingIdentifier) {
      throw new ConflictException(
        `Platform identifier ${createPlatformDto.platformIdentifier} is already linked to another user`,
      );
    }

    const platform = this.userPlatformRepository.create({
      userId,
      platform: createPlatformDto.platform,
      platformIdentifier: createPlatformDto.platformIdentifier,
    });

    return await this.userPlatformRepository.save(platform);
  }

  async unlinkPlatform(userId: number, platform: Platform): Promise<void> {
    const platformLink = await this.userPlatformRepository.findOne({
      where: { userId, platform },
    });

    if (!platformLink) {
      throw new NotFoundException(
        `Platform ${platform} not linked to user ${userId}`,
      );
    }

    await this.userPlatformRepository.remove(platformLink);
  }

  async getUserPlatforms(userId: number): Promise<UserPlatform[]> {
    return await this.userPlatformRepository.find({
      where: { userId },
      order: { linkedAt: 'DESC' },
    });
  }
}
