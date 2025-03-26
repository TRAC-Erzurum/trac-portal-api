export class SessionListItemDto {
  id: string;
  name: string;
  startedAt: Date;
  endedAt: Date;
  attendeesCount: number;
  operator: { id: string; callSign: string };
}
