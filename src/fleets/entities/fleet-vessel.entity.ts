import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Fleet } from './fleet.entity';

@Entity('fleet_vessels')
@Unique(['fleetId', 'vesselId'])
export class FleetVessel {
  @ApiProperty({ description: 'Fleet Vessel ID' })
  @PrimaryGeneratedColumn('increment') // bigserial
  id: number;

  @ApiProperty({ description: 'Fleet ID' })
  @Column({ type: 'bigint', name: 'fleet_id' })
  fleetId: number;

  @ApiProperty({ description: 'Vessel ID (UUID string)' })
  @Column({ type: 'varchar', length: 36, name: 'vessel_id' })
  vesselId: string;

  @ApiProperty({ description: 'Date when vessel was added to fleet' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Fleet, (fleet) => fleet.vessels, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fleet_id' })
  fleet: Fleet;
}

