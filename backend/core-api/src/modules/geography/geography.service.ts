import { findOrFail } from '@finance-crm/common';
import {
  BlacklistedPincode,
  Branch,
  City,
  DataSource,
  Pincode,
  State,
  User,
} from '@finance-crm/database';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { CreateBlacklistedPincodeDto } from './dto/create-blacklisted-pincode.dto';
import { CreateBranchDto } from './dto/create-branch.dto';
import { CreateCityDto } from './dto/create-city.dto';
import { CreateDataSourceDto } from './dto/create-data-source.dto';
import { CreatePincodeDto } from './dto/create-pincode.dto';
import { CreateStateDto } from './dto/create-state.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { UpdateCityDto } from './dto/update-city.dto';
import { UpdateDataSourceDto } from './dto/update-data-source.dto';
import { UpdatePincodeDto } from './dto/update-pincode.dto';
import { UpdateStateDto } from './dto/update-state.dto';

@Injectable()
export class GeographyService {
  constructor(
    @InjectRepository(State)
    private readonly stateRepository: Repository<State>,
    @InjectRepository(City)
    private readonly cityRepository: Repository<City>,
    @InjectRepository(Pincode)
    private readonly pincodeRepository: Repository<Pincode>,
    @InjectRepository(BlacklistedPincode)
    private readonly blacklistedPincodeRepository: Repository<BlacklistedPincode>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(DataSource)
    private readonly dataSourceRepository: Repository<DataSource>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  // States
  listStates(): Promise<State[]> {
    return this.stateRepository.find({
      where: { isActive: true },
      order: { id: 'ASC' },
    });
  }

  findStateById(id: number): Promise<State> {
    return findOrFail(this.stateRepository, id, 'State');
  }

  createState(dto: CreateStateDto): Promise<State> {
    const state = this.stateRepository.create({
      name: dto.name,
      code: dto.code ?? null,
    });
    return this.stateRepository.save(state);
  }

  async updateState(id: number, dto: UpdateStateDto): Promise<State> {
    const state = await this.findStateById(id);
    if (dto.name !== undefined) state.name = dto.name;
    if (dto.code !== undefined) state.code = dto.code;
    return this.stateRepository.save(state);
  }

  async removeState(id: number): Promise<void> {
    const state = await this.findStateById(id);
    state.isActive = false;
    state.isDeleted = true;
    await this.stateRepository.save(state);
  }

  // Cities
  async listCities(stateId?: number): Promise<City[]> {
    return this.cityRepository.find({
      where: {
        isActive: true,
        ...(stateId ? { state: { id: stateId } } : {}),
      },
      relations: { state: true },
      order: { id: 'ASC' },
    });
  }

  findCityById(id: number): Promise<City> {
    return findOrFail(this.cityRepository, id, 'City');
  }

  async createCity(stateId: number, dto: CreateCityDto): Promise<City> {
    const state = await this.findStateById(stateId);
    const city = this.cityRepository.create({ state, name: dto.name });
    return this.cityRepository.save(city);
  }

  async updateCity(id: number, dto: UpdateCityDto): Promise<City> {
    const city = await this.findCityById(id);
    if (dto.name !== undefined) city.name = dto.name;
    return this.cityRepository.save(city);
  }

  async removeCity(id: number): Promise<void> {
    const city = await this.findCityById(id);
    city.isActive = false;
    city.isDeleted = true;
    await this.cityRepository.save(city);
  }

  // Pincodes
  async listPincodes(cityId?: number): Promise<Pincode[]> {
    return this.pincodeRepository.find({
      where: {
        isActive: true,
        ...(cityId ? { city: { id: cityId } } : {}),
      },
      relations: { city: true },
      order: { id: 'ASC' },
    });
  }

  findPincodeById(id: number): Promise<Pincode> {
    return findOrFail(this.pincodeRepository, id, 'Pincode');
  }

  async createPincode(dto: CreatePincodeDto): Promise<Pincode> {
    const pincode = this.pincodeRepository.create({
      value: dto.value,
      city: await findOrFail(this.cityRepository, dto.cityId, 'City'),
    });
    return this.pincodeRepository.save(pincode);
  }

  async updatePincode(id: number, dto: UpdatePincodeDto): Promise<Pincode> {
    const pincode = await this.findPincodeById(id);
    if (dto.value !== undefined) pincode.value = dto.value;
    if (dto.cityId !== undefined)
      pincode.city = await findOrFail(this.cityRepository, dto.cityId, 'City');
    return this.pincodeRepository.save(pincode);
  }

  async removePincode(id: number): Promise<void> {
    const pincode = await this.findPincodeById(id);
    pincode.isActive = false;
    pincode.isDeleted = true;
    await this.pincodeRepository.save(pincode);
  }

  // Blacklisted pincodes
  listBlacklistedPincodes(): Promise<BlacklistedPincode[]> {
    return this.blacklistedPincodeRepository.find({
      where: { isActive: true },
      order: { id: 'DESC' },
    });
  }

  async createBlacklistedPincode(
    dto: CreateBlacklistedPincodeDto,
    publishedByUserId: number,
  ): Promise<BlacklistedPincode> {
    const publishedBy = await findOrFail(
      this.userRepository,
      publishedByUserId,
      'User',
    );
    const entry = this.blacklistedPincodeRepository.create({
      pincode: dto.pincode,
      publishedBy,
    });
    return this.blacklistedPincodeRepository.save(entry);
  }

  async removeBlacklistedPincode(id: number): Promise<void> {
    const entry = await findOrFail(
      this.blacklistedPincodeRepository,
      id,
      'Blacklisted pincode',
    );
    entry.isActive = false;
    entry.isDeleted = true;
    await this.blacklistedPincodeRepository.save(entry);
  }

  // Branches
  listBranches(): Promise<Branch[]> {
    return this.branchRepository.find({
      where: { isActive: true },
      order: { id: 'ASC' },
    });
  }

  findBranchById(id: number): Promise<Branch> {
    return findOrFail(this.branchRepository, id, 'Branch');
  }

  createBranch(dto: CreateBranchDto): Promise<Branch> {
    const branch = this.branchRepository.create({ name: dto.name });
    return this.branchRepository.save(branch);
  }

  async updateBranch(id: number, dto: UpdateBranchDto): Promise<Branch> {
    const branch = await this.findBranchById(id);
    if (dto.name !== undefined) branch.name = dto.name;
    return this.branchRepository.save(branch);
  }

  async removeBranch(id: number): Promise<void> {
    const branch = await this.findBranchById(id);
    branch.isActive = false;
    branch.isDeleted = true;
    await this.branchRepository.save(branch);
  }

  // Data sources
  listDataSources(): Promise<DataSource[]> {
    return this.dataSourceRepository.find({
      where: { isActive: true },
      order: { id: 'ASC' },
    });
  }

  findDataSourceById(id: number): Promise<DataSource> {
    return findOrFail(this.dataSourceRepository, id, 'Data source');
  }

  createDataSource(dto: CreateDataSourceDto): Promise<DataSource> {
    const dataSource = this.dataSourceRepository.create({
      name: dto.name,
      code: dto.code,
    });
    return this.dataSourceRepository.save(dataSource);
  }

  async updateDataSource(
    id: number,
    dto: UpdateDataSourceDto,
  ): Promise<DataSource> {
    const dataSource = await this.findDataSourceById(id);
    if (dto.name !== undefined) dataSource.name = dto.name;
    if (dto.code !== undefined) dataSource.code = dto.code;
    return this.dataSourceRepository.save(dataSource);
  }

  async removeDataSource(id: number): Promise<void> {
    const dataSource = await this.findDataSourceById(id);
    dataSource.isActive = false;
    dataSource.isDeleted = true;
    await this.dataSourceRepository.save(dataSource);
  }
}
