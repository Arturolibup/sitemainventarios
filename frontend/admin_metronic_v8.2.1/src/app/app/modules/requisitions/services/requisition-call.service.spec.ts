import { TestBed } from '@angular/core/testing';

import { RequisitionCallService } from './requisition-call.service';

describe('RequisitionCallService', () => {
  let service: RequisitionCallService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RequisitionCallService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
