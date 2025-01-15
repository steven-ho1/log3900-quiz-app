import { CanActivateFn } from '@angular/router';

export const electronGuard: CanActivateFn = () => {
    if (window.electron) return true;
    return false;
};
