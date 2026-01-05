import { TestBed } from '@angular/core/testing';

import { ServiceSignaService } from './service-signa.service';

describe('ServiceSignaService', () => {
  let service: ServiceSignaService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ServiceSignaService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
