import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';

import { HttpClientTestingModule } from '@angular/common/http/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { Route } from '@app/constants/enums';
import { SNACK_BAR_ERROR_CONFIGURATION } from '@app/constants/snack-bar-configuration';
import { GameHandlingService } from '@app/services/game-handling/game-handling.service';
import { RouteControllerService } from '@app/services/route-controller/route-controller.service';
import { of, throwError } from 'rxjs';
import { PasswordPopupComponent } from './password-popup.component';

describe('PasswordPopupComponent', () => {
    let component: PasswordPopupComponent;
    let fixture: ComponentFixture<PasswordPopupComponent>;
    let matDialogRefSpy: jasmine.SpyObj<MatDialogRef<PasswordPopupComponent>>;
    let gameHandlingServiceMock: jasmine.SpyObj<GameHandlingService>;
    let routerMock: jasmine.SpyObj<Router>;

    beforeEach(() => {
        matDialogRefSpy = jasmine.createSpyObj('PasswordPopupComponent', ['close']);
        gameHandlingServiceMock = jasmine.createSpyObj('GameHandlingService', ['verifyAdminPassword']);
        routerMock = jasmine.createSpyObj('Router', ['navigate']);

        TestBed.configureTestingModule({
            declarations: [PasswordPopupComponent],
            imports: [
                HttpClientTestingModule,
                MatSnackBarModule,
                BrowserAnimationsModule,
                MatFormFieldModule,
                MatInputModule,
                MatIconModule,
                ReactiveFormsModule,
            ],
            providers: [
                { provide: MatDialogRef, useValue: matDialogRefSpy },
                { provide: GameHandlingService, useValue: gameHandlingServiceMock },
                { provide: Router, useValue: routerMock },
            ],
        });
        fixture = TestBed.createComponent(PasswordPopupComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
        component.passwordForm = new FormControl('');
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should navigate to admin route when password is correct', fakeAsync(() => {
        const routeControllerSpy = spyOn(TestBed.inject(RouteControllerService), 'setRouteAccess');
        gameHandlingServiceMock.verifyAdminPassword.and.returnValue(of(true));
        component.validatePassword();
        tick();
        expect(matDialogRefSpy.close).toHaveBeenCalled();
        expect(routeControllerSpy).toHaveBeenCalledWith(Route.Admin, true);
        expect(routerMock.navigate).toHaveBeenCalledWith([Route.Admin]);
    }));

    it('should set isPasswordInvalid to true when password is incorrect', fakeAsync(() => {
        const formSpy = spyOn(component.passwordForm, 'setErrors');
        gameHandlingServiceMock.verifyAdminPassword.and.returnValue(throwError(() => ({ status: 401 })));
        component.validatePassword();
        tick();
        expect(formSpy).toHaveBeenCalledWith({ wrongPassword: true });
    }));

    it('should open a snack bar on other errors', fakeAsync(() => {
        const snackBarSpy = spyOn(component['snackBar'], 'open');
        gameHandlingServiceMock.verifyAdminPassword.and.returnValue(throwError(() => ({ status: 500 })));
        component.validatePassword();
        tick();
        expect(snackBarSpy).toHaveBeenCalledWith('Une erreur est survenue ⚠️', '', SNACK_BAR_ERROR_CONFIGURATION);
    }));
});
