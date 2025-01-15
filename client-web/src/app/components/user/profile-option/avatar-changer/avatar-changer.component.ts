import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, inject, ViewChild } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SNACK_BAR_ERROR_CONFIGURATION, SNACK_BAR_NORMAL_CONFIGURATION } from '@app/constants/snack-bar-configuration';
import { AuthService } from '@app/services/auth/auth.service';
import { AVATAR_MAX_SIZE_BYTES, Item, ItemType, ORIENTATION, QUALITY, RATIO, VALID_FILE_TYPES } from '@common/item';
import { Language, ProfileUpdate, User } from '@common/user';
import { TranslateService } from '@ngx-translate/core';
import { StatusCodes } from 'http-status-codes';
import { NgxImageCompressService } from 'ngx-image-compress';

@Component({
    selector: 'app-avatar-changer',
    templateUrl: './avatar-changer.component.html',
    styleUrls: ['./avatar-changer.component.scss'],
})
export class AvatarChangerComponent {
    @ViewChild('fileUploadInput', { static: false }) fileUploadInput: ElementRef;
    protected avatarForm: FormControl;
    protected isEditingAvatar: boolean = false;
    protected avatars: Item[];
    protected selectedAvatar: string;
    protected originalAvatar: string;
    protected fileName: string = '';
    protected errorMessage: string = '';
    protected currentLanguage: string;

    private translate: TranslateService = inject(TranslateService);

    constructor(
        private authService: AuthService,
        private snackbar: MatSnackBar,
        private imageCompress: NgxImageCompressService,
    ) {
        this.initialize();
        this.currentLanguage = this.translate.currentLang;
        this.translate.onLangChange.subscribe((event) => {
            this.currentLanguage = event.lang;
        });
    }

    protected initialize() {
        const user: User = this.authService.user as User;
        this.avatars = user.ownedItems.filter((item: Item) => item.type === ItemType.Avatar) as Item[];
        this.avatarForm = new FormControl(user.avatar, Validators.required);
        this.selectedAvatar = user.avatar;
        this.originalAvatar = user.avatar;
    }

    protected getAvatarImage(avatarUrl: string) {
        return this.authService.getAvatarImage(avatarUrl);
    }

    protected editAvatar() {
        this.isEditingAvatar = true;
    }

    protected cancelEdit() {
        this.isEditingAvatar = false;
        this.avatarForm.reset(this.originalAvatar);
        this.selectedAvatar = this.originalAvatar;
        this.fileName = '';
    }

    protected onAvatarSelect(avatarUrl: string) {
        this.selectedAvatar = avatarUrl;
        this.avatarForm.patchValue(avatarUrl);
        this.fileName = '';
        this.fileUploadInput.nativeElement.value = '';
        this.errorMessage = '';
    }

    protected onImageUpload() {
        if (this.fileUploadInput.nativeElement.files && this.fileUploadInput.nativeElement.files.length > 0) {
            const file = this.fileUploadInput.nativeElement.files[0];

            if (!VALID_FILE_TYPES.includes(file.type)) {
                this.errorMessage = this.currentLanguage === Language.French ? 'Format non accepté!' : 'Unsupported format!';
                return;
            }

            if (file.size > AVATAR_MAX_SIZE_BYTES) {
                this.errorMessage = this.currentLanguage === Language.French ? 'Fichier volumineux!' : 'File is too large!';

                return;
            }

            this.errorMessage = '';
            const reader = new FileReader();
            /*
                An event handler is assigned to the onload event of the FileReader instance.
                This event is triggered when the file reading operation is successfully completed (after calling readAsDataURL method)
            */
            reader.onload = (e) => {
                const avatarUrl = e.target?.result as string;

                this.imageCompress.compressFile(avatarUrl, ORIENTATION, RATIO, QUALITY).then((result) => {
                    this.selectedAvatar = result;
                    this.avatarForm.patchValue(result);
                    this.fileName = file.name;
                });
            };

            /*
                FileReader reads the file and the result is a Data URL, which is a string that represents the file's data encoded in base64 format 
                and can be used as a source for an <img> tag or as a background image in CSS.
            */
            reader.readAsDataURL(file);
        }
    }

    protected onSubmit() {
        const profileUpdate: ProfileUpdate = { avatar: this.avatarForm.value };
        this.authService.updateAvatar(profileUpdate).subscribe({
            next: (user: User) => {
                this.authService.user = user;
                this.snackbar.open(
                    this.currentLanguage === Language.French ? 'Avatar mis à jour!' : 'Avatar updated!',
                    '',
                    SNACK_BAR_NORMAL_CONFIGURATION,
                );
                this.originalAvatar = this.selectedAvatar;
                this.cancelEdit();
                if (window.electron) {
                    window.electron.ipcRenderer.send('user-change', user);
                }
            },
            error: (error: HttpErrorResponse) => {
                if (error.status === StatusCodes.UNAUTHORIZED) this.authService.redirectToLogin();
                else if (error.status === StatusCodes.NOT_FOUND)
                    this.snackbar.open(
                        this.currentLanguage === Language.French ? 'Erreur inattendue lors de la mise à jour' : 'Unexpected error',
                        '',
                        SNACK_BAR_ERROR_CONFIGURATION,
                    );
            },
        });
    }
}
