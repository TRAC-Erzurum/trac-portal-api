import { Column, Entity, Unique } from 'typeorm';
import { BaseEntity } from '../../shared/entities/base.entity';
import { CommunicationChannelType } from '../enums/communication-channel-type.enum';

@Entity('communication_channel_tutorials')
@Unique(['type', 'locale'])
export class CommunicationChannelTutorial extends BaseEntity {
  @Column({ nullable: false, type: 'enum', enum: CommunicationChannelType })
  type: CommunicationChannelType;

  @Column({ nullable: false })
  title: string;

  @Column({ nullable: false, type: 'text' })
  content: string;

  @Column({ nullable: false, length: 5 })
  locale: string;
}
