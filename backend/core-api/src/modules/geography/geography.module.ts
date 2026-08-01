import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { BlacklistedPincodesController } from './blacklisted-pincodes.controller';
import { BranchesController } from './branches.controller';
import { CitiesController } from './cities.controller';
import { DataSourcesController } from './data-sources.controller';
import { GeographyService } from './geography.service';
import { PincodesController } from './pincodes.controller';
import { StatesController } from './states.controller';

@Module({
  imports: [CommonModule],
  providers: [GeographyService],
  controllers: [
    StatesController,
    CitiesController,
    PincodesController,
    BlacklistedPincodesController,
    BranchesController,
    DataSourcesController,
  ],
})
export class GeographyModule {}
