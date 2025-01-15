import { TestBed } from '@angular/core/testing';
import { CanActivateFn } from '@angular/router';

import { electronGuard } from './electron.guard';

describe('electronGuard', () => {
    const executeGuard: CanActivateFn = async (...guardParameters) => TestBed.runInInjectionContext(async () => electronGuard(...guardParameters));

    beforeEach(() => {
        TestBed.configureTestingModule({});
    });

    it('should be created', () => {
        expect(executeGuard).toBeTruthy();
    });
});
