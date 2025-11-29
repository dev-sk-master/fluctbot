import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../users/entities/user.entity';
import { FleetVessel } from './fleet-vessel.entity';

@Entity('fleets')
export class Fleet {
  @ApiProperty({ description: 'Fleet ID' })
  @PrimaryGeneratedColumn('increment') // bigserial
  id: number;

  @ApiProperty({ description: 'User ID who owns the fleet' })
  @Column({ type: 'bigint', name: 'user_id' })
  userId: number;

  @ApiProperty({ description: 'Fleet name', maxLength: 100 })
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @ApiProperty({ description: 'Fleet description', required: false })
  @Column({ type: 'text', nullable: true })
  description?: string;

  @ApiProperty({ description: 'Date when fleet was created' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({ description: 'Date when fleet was last updated' })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => FleetVessel, (fleetVessel) => fleetVessel.fleet)
  vessels: FleetVessel[];
}

