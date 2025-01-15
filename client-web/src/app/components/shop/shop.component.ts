import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SNACK_BAR_ERROR_CONFIGURATION, SNACK_BAR_NORMAL_CONFIGURATION } from '@app/constants/snack-bar-configuration';
import { ShopCategory } from '@app/constants/user';
import { AuthService } from '@app/services/auth/auth.service';
import { ShopService } from '@app/services/shop/shop.service';
import { Item, SHOP_AVATARS, SHOP_THEMES } from '@common/item';
import { Language, User } from '@common/user';
import { TranslateService } from '@ngx-translate/core';
import { StatusCodes } from 'http-status-codes';

@Component({
    selector: 'app-shop',
    templateUrl: './shop.component.html',
    styleUrls: ['./shop.component.scss'],
})
export class ShopComponent {
    protected activeSection: ShopCategory = ShopCategory.Avatar;
    protected ownedItems: Item[];

    protected avatarCategory: ShopCategory = ShopCategory.Avatar;
    protected themeCategory: ShopCategory = ShopCategory.Theme;
    protected avatars: Item[] = [];
    protected themes: Item[] = [];
    protected currentLanguage: string;
    private snackbar: MatSnackBar = inject(MatSnackBar);
    private translate: TranslateService = inject(TranslateService);

    constructor(
        private authService: AuthService,
        private dialogRef: MatDialogRef<ShopComponent>,
        private shopService: ShopService,
    ) {
        this.ownedItems = this.authService.user?.ownedItems as Item[];
        this.avatars = SHOP_AVATARS.sort((a: Item, b: Item) => (a.cost as number) - (b.cost as number));
        this.themes = SHOP_THEMES.sort((a: Item, b: Item) => (a.cost as number) - (b.cost as number));

        this.currentLanguage = this.translate.currentLang;
        this.translate.onLangChange.subscribe((event) => {
            this.currentLanguage = event.lang;
        });
    }

    get wallet() {
        return this.authService.user?.wallet;
    }

    protected getActiveSection() {
        switch (this.activeSection) {
            case ShopCategory.Avatar:
                return 'Avatars';
            case ShopCategory.Theme:
                return this.currentLanguage === Language.French ? 'Thèmes' : 'Themes';
        }
    }

    protected selectSection(section: ShopCategory) {
        this.activeSection = section;
    }

    protected getAvatar(avatarUrl: string) {
        return this.authService.getAvatarImage(avatarUrl);
    }

    protected getTheme(themeUrl: string) {
        return './assets/backgrounds/' + themeUrl;
    }

    protected purchase(item: Item) {
        this.shopService.sendOrder(item).subscribe({
            next: (user: User) => {
                this.authService.user = user;

                this.ownedItems = user.ownedItems;
                this.snackbar.open(
                    this.currentLanguage === Language.French ? 'Achat confirmé!' : 'Purchase confirmed!',
                    '',
                    SNACK_BAR_NORMAL_CONFIGURATION,
                );
            },
            error: (error: HttpErrorResponse) => {
                switch (error.status) {
                    case StatusCodes.UNAUTHORIZED: {
                        this.authService.redirectToLogin();
                        break;
                    }
                    case StatusCodes.FORBIDDEN: {
                        this.snackbar.open(
                            this.currentLanguage === Language.French ? 'Montant insuffisant' : 'Insufficient amount',
                            '',
                            SNACK_BAR_ERROR_CONFIGURATION,
                        );
                        break;
                    }
                    case StatusCodes.NOT_FOUND:
                    case StatusCodes.BAD_REQUEST:
                        {
                            this.snackbar.open(
                                this.currentLanguage === Language.French ? 'Erreur inattendue' : 'Unexpected error',
                                '',
                                SNACK_BAR_ERROR_CONFIGURATION,
                            );
                            // No default
                        }
                        break;
                }
            },
        });
    }

    protected ownsItem(itemToPurchase: Item) {
        // Peut pas utiliser includes
        return this.ownedItems.some(
            (item: Item) => item.type === itemToPurchase.type && item.imageUrl === itemToPurchase.imageUrl && item.cost === itemToPurchase.cost,
        );
    }

    protected close() {
        this.dialogRef.close();
    }
}
