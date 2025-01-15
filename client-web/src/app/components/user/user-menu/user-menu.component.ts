import { Component, EventEmitter, Output } from '@angular/core';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { ShopComponent } from '@app/components/shop/shop.component';
import { FriendsComponent } from '@app/components/user/friends/friends.component';
import { ProfileComponent } from '@app/components/user/profile-option/profile/profile.component';
import { SettingsComponent } from '@app/components/user/settings-option/settings/settings.component';
import { AuthService } from '@app/services/auth/auth.service';

@Component({
    selector: 'app-user-menu',
    templateUrl: './user-menu.component.html',
    styleUrls: ['./user-menu.component.scss'],
})
export class UserMenuComponent {
    @Output() settingsClose = new EventEmitter<void>();
    protected avatar: string | undefined;
    protected username: string | undefined;
    protected isMenuOpen: boolean = false;
    private readonly dialogConfig: MatDialogConfig = {
        width: '60%',
        height: '70%',
        backdropClass: 'backdropBackground',
        disableClose: true,
    };

    constructor(
        private authService: AuthService,
        private dialog: MatDialog,
    ) {
        this.avatar = authService.user?.avatar;
        this.username = authService.user?.username;
    }

    get wallet() {
        return this.authService.user?.wallet;
    }

    protected getAvatarImage(avatarUrl: string) {
        return this.authService.getAvatarImage(avatarUrl);
    }

    protected toggleMenuState(): void {
        this.isMenuOpen = !this.isMenuOpen;
    }

    protected logout(): void {
        this.authService.redirectToLogin();
    }

    protected openProfile() {
        this.dialog
            .open(ProfileComponent, this.dialogConfig)
            .afterClosed()
            .subscribe(() => {
                this.avatar = this.authService.user?.avatar;
                this.username = this.authService.user?.username;
            });
    }

    protected openSettings() {
        this.dialog
            .open(SettingsComponent, this.dialogConfig)
            .afterClosed()
            .subscribe(() => {
                this.settingsClose.emit();
            });
    }

    protected openFriends() {
        this.dialog.open(FriendsComponent, this.dialogConfig);
    }

    protected openShop() {
        this.dialog.open(ShopComponent, this.dialogConfig);
    }
}
