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

@Injectable()
export class OperatorService {
  constructor(
    @InjectRepository(Operator)
    private readonly operatorRepository: Repository<Operator>,
  ) {}

  async findAll(): Promise<Operator[]> {
    return this.operatorRepository
      .createQueryBuilder('operator')
      .leftJoinAndSelect('operator.user', 'user')
      .orderBy('CASE WHEN user.id IS NULL THEN 1 ELSE 0 END', 'ASC')
      .addOrderBy('operator.callSign', 'ASC')
      .getMany();
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

  async create(operatorData: DeepPartial<Operator>): Promise<Operator> {
    const existingOperator = await this.operatorRepository.findOne({
      where: { callSign: operatorData.callSign },
      relations: { user: true },
    });

    if (!existingOperator) {
      const operator = this.operatorRepository.create(operatorData);
      return this.operatorRepository.save(operator);
    }

    if (existingOperator.user) {
      throw new ForbiddenException(
        `Operator with call sign ${operatorData.callSign} already exists`,
      );
    }

    Object.assign(existingOperator, operatorData);
    return this.operatorRepository.save(existingOperator);
  }

  async update(
    id: string,
    operatorData: DeepPartial<Operator>,
  ): Promise<Operator> {
    const operator = await this.operatorRepository.findOne({ where: { id } });
    if (!operator) {
      throw new NotFoundException(`Operator with ID ${id} not found`);
    }
    Object.assign(operator, operatorData);
    return this.operatorRepository.save(operator);
  }

  async import(records: Record<string, string>[]): Promise<void> {
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
