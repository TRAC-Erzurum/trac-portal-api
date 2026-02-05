import { Column, Entity, Unique } from 'typeorm';
import { BaseEntity } from '../../shared/entities/base.entity';
import { InfrastructureType } from '../enums/infrastructure-type.enum';

@Entity('infrastructure_tutorials')
@Unique(['type', 'locale'])
export class InfrastructureTutorial extends BaseEntity {
  @Column({ nullable: false, type: 'enum', enum: InfrastructureType })
  type: InfrastructureType;

  @Column({ nullable: false })
  title: string;

  @Column({ nullable: false, type: 'text' })
  content: string;

  @Column({ nullable: false, length: 5 })
  locale: string;
}
