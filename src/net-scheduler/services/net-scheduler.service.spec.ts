import { ForbiddenException } from '@nestjs/common';
import { NetSchedulerService } from './net-scheduler.service';
import { NetRecurrence } from '../enums/net-recurrence.enum';
import { classifyNetSchedulerStatus } from '../utils/net-scheduler-status.util';
import { BranchRole, GlobalRole } from '../../auth/enums/role.enum';

const TODAY = '2026-11-21';

describe('NetSchedulerService.delete (branch authorization)', () => {
  const scheduler = { id: 's1', branchId: 'b1' };

  function build(opts: { role: string; isMember: boolean }) {
    const schedulerRepository = {
      findOne: jest.fn().mockResolvedValue(scheduler),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    const userService = {
      getEffectiveRole: jest.fn().mockResolvedValue(opts.role),
      validateBranchMembership: jest
        .fn()
        .mockImplementation(() =>
          opts.isMember
            ? Promise.resolve()
            : Promise.reject(new ForbiddenException('error.notBranchMember')),
        ),
    };
    const service = new NetSchedulerService(
      schedulerRepository as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      userService as never,
      {} as never,
      {} as never,
    );
    return { service, schedulerRepository, userService };
  }

  it('rejects a user who is not a member of the plan branch', async () => {
    const { service, schedulerRepository, userService } = build({
      role: BranchRole.MEMBER,
      isMember: false,
    });

    await expect(service.delete('s1', 'u-outsider')).rejects.toThrow(
      ForbiddenException,
    );
    expect(userService.validateBranchMembership).toHaveBeenCalledWith(
      'u-outsider',
      'b1',
    );
    expect(schedulerRepository.remove).not.toHaveBeenCalled();
  });

  it('allows a member of the plan branch', async () => {
    const { service, schedulerRepository } = build({
      role: BranchRole.MEMBER,
      isMember: true,
    });

    await service.delete('s1', 'u-member');
    expect(schedulerRepository.remove).toHaveBeenCalledWith(scheduler);
  });

  it('skips the membership check for super admins', async () => {
    const { service, schedulerRepository, userService } = build({
      role: GlobalRole.SUPER_ADMIN,
      isMember: false,
    });

    await service.delete('s1', 'u-admin');
    expect(userService.validateBranchMembership).not.toHaveBeenCalled();
    expect(schedulerRepository.remove).toHaveBeenCalled();
  });
});

describe('classifyNetSchedulerStatus', () => {
  const base = {
    isActive: true,
    endDate: null as string | null,
    recurrence: NetRecurrence.WEEKLY,
  };

  it.each([
    ['active: running, no end date', base, false, 'active'],
    [
      'active: end date in the future',
      { ...base, endDate: '2026-12-31' },
      false,
      'active',
    ],
    ['active: end date is today', { ...base, endDate: TODAY }, false, 'active'],
    [
      'active: one-time without a net yet',
      { ...base, recurrence: NetRecurrence.ONE_TIME },
      false,
      'active',
    ],
    ['paused: isActive false', { ...base, isActive: false }, false, 'paused'],
    [
      'paused: isActive false with future end date',
      { ...base, isActive: false, endDate: '2026-12-31' },
      false,
      'paused',
    ],
    [
      'ended by date: end date yesterday',
      { ...base, endDate: '2026-11-20' },
      false,
      'ended',
    ],
    [
      'ended by date: paused and past end date',
      { ...base, isActive: false, endDate: '2026-11-01' },
      false,
      'ended',
    ],
    [
      'ended: one-time with a net',
      { ...base, recurrence: NetRecurrence.ONE_TIME },
      true,
      'ended',
    ],
    ['active: recurring plan with a net is still active', base, true, 'active'],
  ])('%s', (_name, scheduler, hasNet, expected) => {
    expect(classifyNetSchedulerStatus(scheduler, hasNet, TODAY)).toBe(expected);
  });
});
