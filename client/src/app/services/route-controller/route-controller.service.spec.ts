import { TestBed } from '@angular/core/testing';

import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { Route } from '@app/constants/enums';
import { ACCESS_DENIED_MESSAGE, SNACK_BAR_ERROR_CONFIGURATION } from '@app/constants/snack-bar-configuration';
import { IsRouteAccessible, RouteControllerService } from './route-controller.service';

describe('RouteControllerService', () => {
    const adminRoute: Route = Route.Admin;
    const mainMenuRoute: Route = Route.MainMenu;
    let service: RouteControllerService;
    let snackBarMock: jasmine.SpyObj<MatSnackBar>;
    let routerMock: jasmine.SpyObj<Router>;
    let mapMock: Map<Route, IsRouteAccessible>;

    beforeEach(() => {
        snackBarMock = jasmine.createSpyObj('MatSnackBar', ['open']);
        routerMock = jasmine.createSpyObj('Router', ['navigate']);
        mapMock = new Map<Route, IsRouteAccessible>([[adminRoute, false]]);

        TestBed.configureTestingModule({
            providers: [
                { provide: MatSnackBar, useValue: snackBarMock },
                { provide: Router, useValue: routerMock },
            ],
        });
        service = TestBed.inject(RouteControllerService);
        service.routes = mapMock;
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it("setRouteAccess should set a Route's value in routes Map to true if argument isRouteAccessible is true", () => {
        spyOn(service.routes, 'set').and.callThrough();

        service.setRouteAccess(adminRoute, true);
        expect(service.routes.set).toHaveBeenCalledWith(adminRoute, true);
        expect(mapMock.get(adminRoute)).toBeTrue();
    });

    it("setRouteAccess should set a Route's value in routes Map to false if argument isRouteAccessible is false", () => {
        spyOn(service.routes, 'set').and.callThrough();

        service.setRouteAccess(adminRoute, false);
        expect(service.routes.set).toHaveBeenCalledWith(adminRoute, false);
        expect(mapMock.get(adminRoute)).toBeFalse();
    });

    it('isRouteAccessible should return true if a route is accessible', () => {
        spyOn(service.routes, 'get').and.returnValue(true);

        expect(service.isRouteAccessible(adminRoute)).toBeTrue();
        expect(service.routes.get).toHaveBeenCalledWith(adminRoute);
    });

    it('isRouteAccessible should return false if a route is not accessible', () => {
        spyOn(service.routes, 'get').and.returnValue(false);
        expect(service.isRouteAccessible(adminRoute)).toBeFalse();
    });

    it('isRouteAccessible should open a snack bar and navigate to the main menu if a route is not accessible', () => {
        spyOn(service.routes, 'get').and.returnValue(false);

        service.isRouteAccessible(adminRoute);
        expect(snackBarMock.open).toHaveBeenCalledWith(ACCESS_DENIED_MESSAGE, '', SNACK_BAR_ERROR_CONFIGURATION);
        expect(routerMock.navigate).toHaveBeenCalledWith([mainMenuRoute]);
    });
});
