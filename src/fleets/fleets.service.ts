import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Fleet } from './entities/fleet.entity';
import { FleetVessel } from './entities/fleet-vessel.entity';

export interface CreateFleetData {
  userId: number;
  name: string;
  description?: string;
}

export interface AddVesselToFleetData {
  fleetId: number;
  vesselId: string; // IMO number
}

@Injectable()
export class FleetsService {
  constructor(
    @InjectRepository(Fleet)
    private readonly fleetRepository: Repository<Fleet>,
    @InjectRepository(FleetVessel)
    private readonly fleetVesselRepository: Repository<FleetVessel>,
  ) {}

  /**
   * Create a new fleet for a user
   */
  async createFleet(fleetData: CreateFleetData): Promise<Fleet> {
    const fleet = this.fleetRepository.create({
      userId: fleetData.userId,
      name: fleetData.name,
      description: fleetData.description || '',
    });

    return await this.fleetRepository.save(fleet);
  }

  /**
   * Get all fleets for a user
   */
  async getUserFleets(userId: number): Promise<Fleet[]> {
    return await this.fleetRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get a fleet by ID
   */
  async getFleetById(fleetId: number, userId?: number): Promise<Fleet | null> {
    const where: any = { id: fleetId };
    if (userId) {
      where.userId = userId;
    }

    return await this.fleetRepository.findOne({ where });
  }

  /**
   * Update a fleet's name
   */
  async renameFleet(
    fleetId: number,
    newName: string,
    userId: number,
  ): Promise<Fleet> {
    const fleet = await this.fleetRepository.findOne({
      where: { id: fleetId, userId },
    });

    if (!fleet) {
      throw new NotFoundException(
        'Fleet not found or you do not have permission to rename it',
      );
    }

    fleet.name = newName;
    return await this.fleetRepository.save(fleet);
  }

  /**
   * Delete a fleet and all its vessels
   */
  async deleteFleet(fleetId: number, userId: number): Promise<void> {
    const fleet = await this.fleetRepository.findOne({
      where: { id: fleetId, userId },
    });

    if (!fleet) {
      throw new NotFoundException(
        'Fleet not found or you do not have permission to delete it',
      );
    }

    await this.fleetRepository.remove(fleet);
  }

  /**
   * Add a vessel to a fleet
   */
  async addVesselToFleet(
    vesselData: AddVesselToFleetData,
    userId: number,
  ): Promise<FleetVessel> {
    // Verify user owns the fleet
    const fleet = await this.fleetRepository.findOne({
      where: { id: vesselData.fleetId, userId },
    });

    if (!fleet) {
      throw new NotFoundException(
        'Fleet not found or you do not have permission to add vessels to it',
      );
    }

    // Check if vessel already exists in this fleet
    const existingVessel = await this.fleetVesselRepository.findOne({
      where: {
        fleetId: vesselData.fleetId,
        vesselId: vesselData.vesselId,
      },
    });

    if (existingVessel) {
      throw new Error('Vessel is already in this fleet');
    }

    const fleetVessel = this.fleetVesselRepository.create({
      fleetId: vesselData.fleetId,
      vesselId: vesselData.vesselId,
    });

    return await this.fleetVesselRepository.save(fleetVessel);
  }

  /**
   * Remove a vessel from a fleet
   */
  async removeVesselFromFleet(
    fleetId: number,
    vesselId: string,
    userId: number,
  ): Promise<void> {
    // Verify user owns the fleet
    const fleet = await this.fleetRepository.findOne({
      where: { id: fleetId, userId },
    });

    if (!fleet) {
      throw new NotFoundException(
        'Fleet not found or you do not have permission to remove vessels from it',
      );
    }

    const vessel = await this.fleetVesselRepository.findOne({
      where: { fleetId, vesselId },
    });

    if (!vessel) {
      throw new NotFoundException('Vessel not found in this fleet');
    }

    await this.fleetVesselRepository.remove(vessel);
  }

  /**
   * Get all vessels in a fleet
   */
  async getFleetVessels(
    fleetId: number,
    userId: number,
  ): Promise<FleetVessel[]> {
    // Verify user owns the fleet
    const fleet = await this.fleetRepository.findOne({
      where: { id: fleetId, userId },
    });

    if (!fleet) {
      throw new NotFoundException(
        'Fleet not found or you do not have permission to view it',
      );
    }

    return await this.fleetVesselRepository.find({
      where: { fleetId },
      order: { createdAt: 'DESC' },
    });
  }
}

