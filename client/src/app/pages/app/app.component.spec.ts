import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { ClientSocketServiceMock } from '@app/classes/client-socket-service-mock';
import { SocketMock } from '@app/classes/socket-mock';
import { Route } from '@app/constants/enums';
import { SERVER_ERROR_MESSAGE, SNACK_BAR_ERROR_CONFIGURATION } from '@app/constants/snack-bar-configuration';
import { AppRoutingModule } from '@app/modules/app-routing.module';
import { AppComponent } from '@app/pages/app/app.component';
import { ClientSocketService } from '@app/services/client-socket/client-socket.service';

describe('AppComponent', () => {
    let app: AppComponent;
    let fixture: ComponentFixture<AppComponent>;
    let clientSocketServiceMock: ClientSocketServiceMock;
    let routerSpy: jasmine.SpyObj<Router>;
    let snackBarSpy: jasmine.SpyObj<MatSnackBar>;
    let socketMock: SocketMock;

    beforeEach(async () => {
        clientSocketServiceMock = new ClientSocketServiceMock();
        routerSpy = jasmine.createSpyObj('Router', ['navigate']);
        snackBarSpy = jasmine.createSpyObj('ClientSocketService', ['open']);

        await TestBed.configureTestingModule({
            imports: [AppRoutingModule, MatSnackBarModule],
            declarations: [AppComponent],
            providers: [
                { provide: ClientSocketService, useValue: clientSocketServiceMock },
                { provide: Router, useValue: routerSpy },
                { provide: MatSnackBar, useValue: snackBarSpy },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(AppComponent);
        app = fixture.componentInstance;
        fixture.detectChanges();
        socketMock = clientSocketServiceMock.socket as unknown as SocketMock;
    });

    it('should create the app', () => {
        expect(app).toBeTruthy();
    });

    it('ngOnInit should call connect through the ClientSocketService', () => {
        spyOn(clientSocketServiceMock, 'connect');
        app.ngOnInit();
        expect(clientSocketServiceMock.connect).toHaveBeenCalled();
    });

    it('ngOnInit should open a snack bar and navigate to main menu', () => {
        app.ngOnInit();
        socketMock.simulateServerEmit('disconnect');
        expect(snackBarSpy.open).toHaveBeenCalledWith(SERVER_ERROR_MESSAGE, '', SNACK_BAR_ERROR_CONFIGURATION);
        expect(routerSpy.navigate).toHaveBeenCalledWith([Route.MainMenu]);
    });

    it('ngOnDestroy should remove listener of disconnect even', () => {
        spyOn(socketMock, 'removeAllListeners');

        app.ngOnDestroy();
        expect(socketMock.removeAllListeners).toHaveBeenCalledWith('disconnect');
    });
});
