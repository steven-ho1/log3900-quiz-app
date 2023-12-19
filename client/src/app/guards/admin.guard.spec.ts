import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, CanActivateFn, RouterStateSnapshot } from '@angular/router';
import { Route } from '@app/constants/enums';
import { RouteControllerService } from '@app/services/route-controller/route-controller.service';
import { adminGuard } from './admin.guard';

describe('adminGuard', () => {
    const executeGuard: CanActivateFn = async (...guardParameters) =>
        TestBed.runInInjectionContext(async () => adminGuard(...guardParameters) as Promise<boolean>);
    let routerControllerServiceMock: jasmine.SpyObj<RouteControllerService>;
    let route: ActivatedRouteSnapshot;
    let state: RouterStateSnapshot;

    beforeEach(() => {
        routerControllerServiceMock = jasmine.createSpyObj('RouteControllerService', ['isRouteAccessible']);

        TestBed.configureTestingModule({
            providers: [
                { provide: RouteControllerService, useValue: routerControllerServiceMock },
                { provide: ActivatedRouteSnapshot, useValue: {} },
                { provide: RouterStateSnapshot, useValue: {} },
            ],
        });
    });

    it('should return true if isRouteAccessible(Route.Admin) returns true', async () => {
        routerControllerServiceMock.isRouteAccessible.and.returnValue(true);

        expect(await executeGuard(route, state)).toBeTrue();
        expect(routerControllerServiceMock.isRouteAccessible).toHaveBeenCalledWith(Route.Admin);
    });

    it('should return false if isRouteAccessible(Route.Admin) returns false', async () => {
        routerControllerServiceMock.isRouteAccessible.and.returnValue(false);
        expect(await executeGuard(route, state)).toBeFalse();
    });
});
