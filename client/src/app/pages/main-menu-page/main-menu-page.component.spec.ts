import { ChangeDetectorRef } from '@angular/core';
import { ComponentFixture, fakeAsync, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatDialogModule } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap, Router, RouterModule } from '@angular/router';
import { ClientSocketServiceMock } from '@app/classes/client-socket-service-mock';
import { SocketMock } from '@app/classes/socket-mock';
import { PasswordPopupComponent } from '@app/components/password-popup/password-popup.component';
import { Route } from '@app/constants/enums';
import { MainMenuPageComponent } from '@app/pages/main-menu-page/main-menu-page.component';
import { ClientSocketService } from '@app/services/client-socket/client-socket.service';
import { GameHandlingService } from '@app/services/game-handling/game-handling.service';
import { Game } from '@common/game';
import { of } from 'rxjs';

describe('MainMenuPageComponent', () => {
    let component: MainMenuPageComponent;
    let fixture: ComponentFixture<MainMenuPageComponent>;
    let gameHandlingServiceMock: jasmine.SpyObj<GameHandlingService>;
    let routerMock: jasmine.SpyObj<Router>;
    let changeDetectorMock: jasmine.SpyObj<ChangeDetectorRef>;
    let socketMock: SocketMock;
    let clientSocketServiceMock: ClientSocketServiceMock;
    let nEmittedEvents: number;

    beforeEach(async () => {
        gameHandlingServiceMock = jasmine.createSpyObj('GameHandlingService', ['verifyAdminPassword', 'setCurrentGameId']);
        routerMock = jasmine.createSpyObj('Router', ['navigate']);
        changeDetectorMock = jasmine.createSpyObj('ChangeDetectorRef', ['detectChanges']);
        clientSocketServiceMock = new ClientSocketServiceMock();

        TestBed.configureTestingModule({
            declarations: [MainMenuPageComponent],
            imports: [MatSnackBarModule, MatDialogModule, ReactiveFormsModule, MatInputModule, BrowserAnimationsModule, RouterModule],
            providers: [
                { provide: GameHandlingService, useValue: gameHandlingServiceMock },
                { provide: Router, useValue: routerMock },
                { provide: ClientSocketService, useValue: clientSocketServiceMock },
                {
                    provide: ActivatedRoute,
                    useValue: {
                        queryParams: of(
                            convertToParamMap({
                                search: '',
                            }),
                        ),
                    },
                },
                { provide: ChangeDetectorRef, useValue: changeDetectorMock },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(MainMenuPageComponent);
        component = fixture.componentInstance;
        socketMock = clientSocketServiceMock.socket as unknown as SocketMock;
        spyOn(socketMock, 'emit').and.callThrough();
        socketMock.clientUniqueEvents.clear();
        nEmittedEvents = 0;
    });

    beforeEach(() => {
        spyOn(window, 'prompt').and.returnValue('testPassword');
        spyOn(window, 'alert').and.stub();
        fixture = TestBed.createComponent(MainMenuPageComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('ngAfterViewInit should focus on joiningButton', () => {
        component.pinInput = {
            nativeElement: {
                focus: () => {
                    return;
                },
            },
        };
        const ngAfterViewInitSpy = spyOn(component.pinInput.nativeElement, 'focus');
        component.ngAfterViewInit();
        expect(ngAfterViewInitSpy).toHaveBeenCalled();
    });

    it('adminLogin should open a dialog', fakeAsync(() => {
        const dialogSpy = spyOn(component['dialog'], 'open');
        component.adminLogin();
        expect(dialogSpy).toHaveBeenCalledWith(PasswordPopupComponent, {
            backdropClass: 'backdropBackground',
            disableClose: true,
        });
    }));

    it('should handle validPin event by navigating to the lobby', () => {
        const game: Game = {
            id: '123',
            title: 'testGame',
            description: 'test Game',
            duration: 20,
            lastModification: 'today',
            questions: [],
        };
        const pin = '1234';
        expect(component['routeController'].isRouteAccessible(Route.Lobby)).toBeFalse();

        socketMock.simulateServerEmit('validPin', game, pin);
        expect(gameHandlingServiceMock.currentGame).toEqual(game);
        expect(clientSocketServiceMock.pin).toEqual(pin);
        expect(component['routeController'].isRouteAccessible(Route.Lobby)).toBeTrue();
        expect(routerMock.navigate).toHaveBeenCalledWith([Route.Lobby]);
    });

    it('should handle invalidPin event by receiving an error from the server', () => {
        const serverMessage = 'erreur';
        socketMock.simulateServerEmit('invalidPin', serverMessage);
        expect(component.serverErrorMessage).toEqual(serverMessage);
    });

    it('containsNonNumeric validator should check if a form control contains non-numeric characters', () => {
        const formControl: FormControl = new FormControl('');

        expect(component.containsNonNumeric(formControl)).toEqual({ containsNonNumeric: true });
        formControl.setValue('a1a2');
        expect(component.containsNonNumeric(formControl)).toEqual({ containsNonNumeric: true });
        formControl.setValue('1341');
        expect(component.containsNonNumeric(formControl)).toBeNull();
    });

    it('pinContainsNonNumeric should return true if the pin contains non-numeric character', () => {
        const invalidPin = '1a2.';

        component.pinForm.controls['pin'].setValue(invalidPin);
        expect(component.pinContainsNonNumeric()).toBeFalse();
        component.pinForm.controls['pin'].markAsDirty();
        expect(component.pinContainsNonNumeric()).toBeTrue();
    });

    it("pinContainsNonNumeric should return false if the pin doesn't contain non-numeric character", () => {
        const validPin = '1234';

        component.pinForm.controls['pin'].setValue(validPin);
        expect(component.pinContainsNonNumeric()).toBeFalse();

        component.pinForm.controls['pin'].markAsDirty();
        expect(component.pinContainsNonNumeric()).toBeFalse();
    });

    it('should return true if the form contains 4 characters', () => {
        const validPin = '1234';
        component.pinForm.controls['pin'].setValue(validPin);
        expect(component.pinForm.valid).toBeTrue();
    });

    it('should return false if the form contains less than 4 characters', () => {
        const invalidPin = '12.';
        component.pinForm.controls['pin'].setValue(invalidPin);
        expect(component.pinForm.valid).toBeFalse();
    });

    it('onSubmit should emit validatePin event through the ClientSocketService', () => {
        const event = 'validatePin';
        const pin = '1234';
        component.pinForm.value.pin = pin;

        component.onSubmit();
        expect(socketMock.emit).toHaveBeenCalledWith(event, pin);
        expect(socketMock.nEmittedEvents).toEqual(++nEmittedEvents);
    });
});
