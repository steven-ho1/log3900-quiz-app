import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { PasswordPopupComponent } from '@app/components/password-popup/password-popup.component';
import { Route } from '@app/constants/enums';
import { ClientSocketService } from '@app/services/client-socket/client-socket.service';
import { GameHandlingService } from '@app/services/game-handling/game-handling.service';
import { RouteControllerService } from '@app/services/route-controller/route-controller.service';
import { Game } from '@common/game';
import { GameMode } from '@common/game-mode';
import { Pin, REQUIRED_PIN_LENGTH } from '@common/lobby';
import { BehaviorSubject } from 'rxjs';

@Component({
    selector: 'app-main-menu-page',
    templateUrl: './main-menu-page.component.html',
    styleUrls: ['./main-menu-page.component.scss'],
})
export class MainMenuPageComponent implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild('pinInput', { static: false }) pinInput: ElementRef;
    gameCreationRoute: string = '/' + Route.GameCreation;
    title: string = 'Survey Genius';
    message: BehaviorSubject<string> = new BehaviorSubject<string>('');
    pinForm: FormGroup;
    serverErrorMessage: string = '';
    private routeController: RouteControllerService = inject(RouteControllerService);
    private dialog: MatDialog = inject(MatDialog);
    private changeDetector: ChangeDetectorRef = inject(ChangeDetectorRef);

    constructor(
        private readonly gameHandler: GameHandlingService,
        private readonly router: Router,
        private readonly clientSocket: ClientSocketService,
    ) {
        const fb: FormBuilder = new FormBuilder();
        this.pinForm = fb.group({
            pin: ['', [Validators.required, Validators.minLength(REQUIRED_PIN_LENGTH), this.containsNonNumeric]],
        });

        this.configureBaseSocketFeatures();
    }

    ngOnInit(): void {
        this.routeController.setRouteAccess(Route.Admin, false);
    }

    ngOnDestroy(): void {
        this.clientSocket.socket.removeAllListeners('validPin');
        this.clientSocket.socket.removeAllListeners('invalidPin');
    }

    ngAfterViewInit(): void {
        if (this.pinInput) {
            this.pinInput.nativeElement.focus();
            this.changeDetector.detectChanges();
        }
    }

    adminLogin(): void {
        this.dialog.open(PasswordPopupComponent, {
            backdropClass: 'backdropBackground',
            disableClose: true,
        });
    }
    // Setup des listeners de base
    configureBaseSocketFeatures() {
        this.clientSocket.socket.on('validPin', (game: Game, pin: Pin) => {
            this.routeController.setRouteAccess(Route.Lobby, true);
            this.gameHandler.gameMode = GameMode.RealGame;
            this.clientSocket.pin = pin;
            this.gameHandler.currentGame = game;
            this.router.navigate([Route.Lobby]);
        });

        this.clientSocket.socket.on('invalidPin', (message: string) => {
            this.serverErrorMessage = message;
        });
    }
    // Controle des caracteres du PIN entry
    containsNonNumeric(control: AbstractControl): null | { containsNonNumeric: boolean } {
        return /^\d+$/.test(control.value) ? null : { containsNonNumeric: true };
    }
    // Controle des caracteres du PIN entry
    pinContainsNonNumeric(): boolean {
        return this.pinForm.controls['pin'].dirty && this.pinForm.invalid;
    }

    onSubmit(): void {
        this.clientSocket.socket.emit('validatePin', this.pinForm.value.pin);
    }
}
