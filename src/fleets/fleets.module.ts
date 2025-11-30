import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FleetsService } from './fleets.service';
import { Fleet } from './entities/fleet.entity';
import { FleetVessel } from './entities/fleet-vessel.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Fleet, FleetVessel])],
  providers: [FleetsService],
  exports: [FleetsService],
})
export class FleetsModule {}

