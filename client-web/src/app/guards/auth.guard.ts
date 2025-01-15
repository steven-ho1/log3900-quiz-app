import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn } from '@angular/router';
import { Route } from '@app/constants/enums';
import { AuthService } from '@app/services/auth/auth.service';

export const authGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
    const authService: AuthService = inject(AuthService);
    const routeToAccess = route.url[0].path;

    if (authService.isAuthenticated) {
        if (routeToAccess === Route.Login || routeToAccess === Route.Register || routeToAccess === Route.PasswordReset) return false;
    } else {
        if (routeToAccess !== Route.Login && routeToAccess !== Route.Register && routeToAccess !== Route.PasswordReset) return false;
    }

    return true;
};
