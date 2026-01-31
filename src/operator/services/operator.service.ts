import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, ILike, IsNull, Not, Repository } from 'typeorm';
import { Operator } from '../entities/operator.entity';
import { chunk, startCase } from 'lodash';
import { OperatorQueryDto } from '../dto/operator-query.dto';

@Injectable()
export class OperatorService {
  constructor(
    @InjectRepository(Operator)
    private readonly operatorRepository: Repository<Operator>,
  ) {}

  async find(
    query: OperatorQueryDto,
  ): Promise<{ data: Operator[]; total: number }> {
    const baseQueryBuilder = this.operatorRepository
      .createQueryBuilder('operator')
      .leftJoinAndSelect('operator.user', 'user');

    if (query.search) {
      const searchTerm = `%${query.search.toLowerCase()}%`;
      baseQueryBuilder.where(
        '(LOWER(operator.callSign) LIKE :search OR ' +
          'LOWER(operator.fullName) LIKE :search OR ' +
          'LOWER(operator.country) LIKE :search OR ' +
          'LOWER(operator.city) LIKE :search OR ' +
          'LOWER(operator.district) LIKE :search OR ' +
          'LOWER(user.fullName) LIKE :search)',
        { search: searchTerm },
      );
    }

    const total = await baseQueryBuilder.getCount();

    const data = await baseQueryBuilder
      .addSelect(
        'CASE WHEN "user"."id" IS NULL THEN 1 ELSE 0 END',
        'user_sort_priority',
      )
      .orderBy('user_sort_priority', 'ASC')
      .addOrderBy('operator.createdAt', 'ASC')
      .addOrderBy('operator.callSign', 'ASC')
      .skip((query.pageNumber - 1) * query.pageSize)
      .take(query.pageSize)
      .getMany();

    return { data, total };
  }

  async findAllWithUser(): Promise<Operator[]> {
    return this.operatorRepository.find({
      where: { user: Not(IsNull()) },
      relations: { user: true },
    });
  }

  async findOne(id: string): Promise<Operator> {
    const operator = await this.operatorRepository.findOne({
      where: { id },
      relations: { user: true },
    });
    if (!operator) {
      throw new NotFoundException(`Operator with ID ${id} not found`);
    }
    return operator;
  }

  async findByCallSign(callSign: string): Promise<Operator | null> {
    return this.operatorRepository.findOne({
      where: { callSign: callSign.toUpperCase() },
      relations: { user: true },
    });
  }

  async create(
    operatorData: DeepPartial<Operator>,
    createdBy: string,
  ): Promise<Operator> {
    const existingOperator = await this.operatorRepository.findOne({
      where: { callSign: operatorData.callSign },
      relations: { user: true },
    });

    if (!existingOperator) {
      const operator = this.operatorRepository.create({
        ...operatorData,
        createdBy,
        updatedBy: [],
      });
      return this.operatorRepository.save(operator);
    }

    if (existingOperator.user) {
      throw new ForbiddenException(
        `Operator with call sign ${operatorData.callSign} already exists`,
      );
    }

    Object.assign(existingOperator, {
      ...operatorData,
      createdBy,
      updatedBy: [],
    });
    return this.operatorRepository.save(existingOperator);
  }

  async update(
    id: string,
    operatorData: DeepPartial<Operator>,
    updatedBy: string,
  ): Promise<Operator> {
    const operator = await this.operatorRepository.findOne({ where: { id } });
    if (!operator) {
      throw new NotFoundException(`Operator with ID ${id} not found`);
    }
    Object.assign(operator, {
      ...operatorData,
      updatedBy: [...(operator.updatedBy || []), updatedBy],
    });
    return this.operatorRepository.save(operator);
  }

  async import(
    records: Record<string, string>[],
    createdBy: string,
  ): Promise<void> {
    const operators = records
      .filter((record) => record.callSign)
      .map((record) => {
        const operator = new Operator();
        operator.callSign = record.callSign.toUpperCase();
        operator.prefix = record.prefix;
        operator.suffix = record.suffix;
        operator.country = startCase(record.country);
        operator.city = startCase(record.city);
        operator.district = startCase(record.district);
        operator.gridSquare = record.gridSquare;
        operator.fullName = startCase(record.fullName);
        operator.createdBy = createdBy;
        operator.updatedBy = [];
        return operator;
      });

    const batchSize = 100;

    for (const operator of chunk(operators, batchSize)) {
      await this.operatorRepository
        .createQueryBuilder()
        .insert()
        .into(Operator)
        .values(operator)
        .orIgnore()
        .execute();
    }
  }

  async search(query: string): Promise<Operator[]> {
    return this.operatorRepository.find({
      where: [
        { callSign: ILike(`%${query}%`) },
        { fullName: ILike(`%${query}%`) },
        { user: { fullName: ILike(`%${query}%`) } },
        { country: ILike(`%${query}%`) },
        { city: ILike(`%${query}%`) },
        { district: ILike(`%${query}%`) },
      ],
      relations: { user: true },
    });
  }

  async delete(id: string): Promise<void> {
    const operator = await this.operatorRepository.findOne({
      where: { id },
      relations: { user: true, attendees: true },
    });
    if (!operator) {
      throw new NotFoundException(`${id} ile eşleşen bir kayıt bulunamadı`);
    }

    if (operator.user) {
      throw new BadRequestException(
        `${operator.callSign} için bir kullanıcı bulunduğu için silinemez`,
      );
    }

    if (operator.attendees.length > 0) {
      throw new BadRequestException(
        `${operator.callSign} en az bir çevrime katıldığı için silinemez`,
      );
    }

    await this.operatorRepository.delete(id);
  }
}
