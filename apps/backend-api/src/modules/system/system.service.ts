import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemSettings } from './entities/system-settings.entity';

@Injectable()
export class SystemService {
  constructor(
    @InjectRepository(SystemSettings)
    private settingsRepository: Repository<SystemSettings>,
  ) {}

  async getSettings(): Promise<SystemSettings> {
    let settings = await this.settingsRepository.findOne({
      where: { id: 'main' },
    });

    if (!settings) {
      settings = this.settingsRepository.create({
        id: 'main',
        withdrawalsPaused: false,
        bettingPaused: false,
        newRoundsPaused: false,
      });
      await this.settingsRepository.save(settings);
    }

    return settings;
  }

  async updateSettings(updates: Partial<SystemSettings>): Promise<SystemSettings> {
    const settings = await this.getSettings();
    Object.assign(settings, updates);
    return this.settingsRepository.save(settings);
  }

  async isWithdrawalsPaused(): Promise<boolean> {
    const settings = await this.getSettings();
    return settings.withdrawalsPaused;
  }

  async isBettingPaused(): Promise<boolean> {
    const settings = await this.getSettings();
    return settings.bettingPaused;
  }

  async isNewRoundsPaused(): Promise<boolean> {
    const settings = await this.getSettings();
    return settings.newRoundsPaused;
  }
}

