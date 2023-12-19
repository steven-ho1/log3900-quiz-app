import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { ActivatedRoute, RouterModule, convertToParamMap } from '@angular/router';
import { ClientSocketServiceMock } from '@app/classes/client-socket-service-mock';
import { ClientSocketService } from '@app/services/client-socket/client-socket.service';
import { RouteControllerService } from '@app/services/route-controller/route-controller.service';
import { of } from 'rxjs';
import { HeaderComponent } from './header.component';

describe('HeaderComponent', () => {
    let component: HeaderComponent;
    let fixture: ComponentFixture<HeaderComponent>;
    let clientSocketServiceMock: ClientSocketServiceMock;

    beforeEach(() => {
        clientSocketServiceMock = new ClientSocketServiceMock();
        TestBed.configureTestingModule({
            declarations: [HeaderComponent],
            imports: [MatIconModule, HttpClientTestingModule, RouterModule, MatSnackBarModule],
            providers: [
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
                {
                    provide: ClientSocketService,
                    useValue: clientSocketServiceMock,
                },
            ],
        });

        fixture = TestBed.createComponent(HeaderComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('isCurrentPageLobby getter should return true if the lobby is accessible and the player is the organizer', () => {
        spyOn(TestBed.inject(RouteControllerService).routes, 'get').and.returnValue(true);
        clientSocketServiceMock.isOrganizer = true;
        expect(component.isCurrentPageLobby).toBeTrue();
    });

    it('isCurrentPageLobby getter should return false if the player is not the organizer', () => {
        spyOn(TestBed.inject(RouteControllerService).routes, 'get').and.returnValue(true);
        clientSocketServiceMock.isOrganizer = false;
        expect(component.isCurrentPageLobby).toBeFalse();
    });

    it('isCurrentPageLobby getter should return false if the lobby is not accessible', () => {
        spyOn(TestBed.inject(RouteControllerService).routes, 'get').and.returnValue(false);
        clientSocketServiceMock.isOrganizer = false;
        expect(component.isCurrentPageLobby).toBeFalse();
    });
});
