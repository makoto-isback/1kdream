import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async findOrCreateByTelegramId(
    telegramId: string,
    data: {
      firstName?: string;
      lastName?: string;
      username?: string;
    },
  ): Promise<User> {
    let user = await this.usersRepository.findOne({
      where: { telegramId },
    });

    if (!user) {
      user = this.usersRepository.create({
        telegramId,
        firstName: data.firstName,
        lastName: data.lastName,
        username: data.username,
        kyatBalance: 0,
        points: 0,
        language: 'en', // Default language
      });
      await this.usersRepository.save(user);
    } else {
      // Update user info if changed
      if (data.firstName) user.firstName = data.firstName;
      if (data.lastName) user.lastName = data.lastName;
      if (data.username) user.username = data.username;
      await this.usersRepository.save(user);
    }

    return user;
  }

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async findByTelegramId(telegramId: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { telegramId },
    });
  }

  async updateBalance(userId: string, amount: number): Promise<User> {
    const user = await this.findOne(userId);
    user.kyatBalance = Number(user.kyatBalance) + amount;
    return this.usersRepository.save(user);
  }

  async addPoints(userId: string, points: number): Promise<User> {
    const user = await this.findOne(userId);
    user.points = Number(user.points) + points;
    return this.usersRepository.save(user);
  }

  async findAll(): Promise<User[]> {
    return this.usersRepository.find();
  }

  async findByTonAddress(tonAddress: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { tonAddress } });
  }

  async updateTonAddress(userId: string, tonAddress: string): Promise<User> {
    const user = await this.findOne(userId);
    user.tonAddress = tonAddress;
    return this.usersRepository.save(user);
  }

  async activateUser(userId: string): Promise<User> {
    const user = await this.findOne(userId);
    
    if (user.isActivated) {
      return user; // Already activated
    }

    user.isActivated = true;
    user.activatedAt = new Date();
    return this.usersRepository.save(user);
  }

  async checkActivationStatus(userId: string): Promise<{ isActivated: boolean; activatedAt: Date | null }> {
    const user = await this.findOne(userId);
    return {
      isActivated: user.isActivated,
      activatedAt: user.activatedAt,
    };
  }

  async updateLanguage(userId: string, language: string): Promise<User> {
    const user = await this.findOne(userId);
    user.language = language;
    return this.usersRepository.save(user);
  }

  async updateLanguageByTelegramId(telegramId: string, language: string): Promise<User | null> {
    const user = await this.findByTelegramId(telegramId);
    if (!user) {
      return null;
    }
    user.language = language;
    return this.usersRepository.save(user);
  }
}
