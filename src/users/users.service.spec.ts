import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { UserPlatform } from './entities/user-platform.entity';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { UserStatus } from './entities/user.entity';
import { Platform } from './entities/user-platform.entity';

describe('UsersService', () => {
  let service: UsersService;
  let userRepository: Repository<User>;
  let platformRepository: Repository<UserPlatform>;

  const mockUserRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
    update: jest.fn(),
  };

  const mockPlatformRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(UserPlatform),
          useValue: mockPlatformRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    platformRepository = module.get<Repository<UserPlatform>>(
      getRepositoryToken(UserPlatform),
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a user', async () => {
      const createUserDto = {
        name: 'Test User',
        email: 'test@example.com',
      };
      const user = {
        id: 1,
        ...createUserDto,
        status: UserStatus.ACTIVE,
        emailVerified: false,
      } as User;

      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.create.mockReturnValue(user);
      mockUserRepository.save.mockResolvedValue(user);

      const result = await service.create(createUserDto);

      expect(result).toEqual(user);
      expect(mockUserRepository.create).toHaveBeenCalledWith({
        name: createUserDto.name,
        email: createUserDto.email,
        phoneNumber: undefined,
        referralCode: undefined,
        status: UserStatus.ACTIVE,
        emailVerified: false,
      });
    });

    it('should throw ConflictException if email exists', async () => {
      const createUserDto = {
        name: 'Test User',
        email: 'test@example.com',
      };
      const existingUser = { id: 1, email: 'test@example.com' } as User;

      mockUserRepository.findOne.mockResolvedValue(existingUser);

      await expect(service.create(createUserDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findOne', () => {
    it('should return a user by id', async () => {
      const user = {
        id: 1,
        name: 'Test',
        email: 'test@example.com',
      } as User;
      mockUserRepository.findOne.mockResolvedValue(user);

      const result = await service.findOne(1);

      expect(result).toEqual(user);
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['platforms'],
      });
    });

    it('should throw NotFoundException if user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(1)).rejects.toThrow(NotFoundException);
    });
  });
});
