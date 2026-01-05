import { TestBed } from '@angular/core/testing';
import { CanActivateFn } from '@angular/router';

import { requisitionRoleGuard } from './requisition-role.guard';

describe('requisitionRoleGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) => 
      TestBed.runInInjectionContext(() => requisitionRoleGuard(...guardParameters));

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});
