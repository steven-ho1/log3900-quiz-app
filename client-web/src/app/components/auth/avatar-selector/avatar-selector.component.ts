import { Component, ElementRef, ViewChild } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { AuthService } from '@app/services/auth/auth.service';
import { AVATAR_MAX_SIZE_BYTES, DEFAULT_AVATARS, Item, NO_AVATAR_IMAGE, ORIENTATION, QUALITY, RATIO, VALID_FILE_TYPES } from '@common/item';
import { Language } from '@common/user';
import { TranslateService } from '@ngx-translate/core';
import { NgxImageCompressService } from 'ngx-image-compress';

@Component({
    selector: 'app-avatar-selector',
    templateUrl: './avatar-selector.component.html',
    styleUrls: ['./avatar-selector.component.scss'],
})
export class AvatarSelectorComponent {
    @ViewChild('fileUploadInput', { static: false }) fileUploadInput: ElementRef;
    protected authForm: FormGroup = this.authService.authForm;
    protected fileName: string = '';
    protected selectedAvatar: string = NO_AVATAR_IMAGE;
    protected errorMessage: string = '';
    protected avatars: Item[] = DEFAULT_AVATARS;
    protected currentLanguage: string;

    constructor(
        private authService: AuthService,
        private imageCompress: NgxImageCompressService,
        private translate: TranslateService,
    ) {
        this.currentLanguage = this.translate.currentLang;
        this.translate.onLangChange.subscribe((event) => {
            this.currentLanguage = event.lang;
        });
    }

    protected onAvatarSelect(avatarUrl: string) {
        this.selectedAvatar = avatarUrl;
        this.authForm.patchValue({ avatar: avatarUrl });

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
                    this.authForm.patchValue({ avatar: result });
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

    protected getAvatarImage(avatarUrl: string) {
        return this.authService.getAvatarImage(avatarUrl);
    }
}
