import { TestBed } from '@angular/core/testing';

import { RefactionTraceService } from './refaction-trace.service';

describe('RefactionTraceService', () => {
  let service: RefactionTraceService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RefactionTraceService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
