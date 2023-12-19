import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

@Component({
    selector: 'app-confirmation-popup',
    templateUrl: './confirmation-popup.component.html',
    styleUrls: ['./confirmation-popup.component.scss'],
})
export class ConfirmationPopupComponent {
    constructor(
        @Inject(MAT_DIALOG_DATA) public data: { title: string; description: string; primaryAction: string },
        public dialogRef: MatDialogRef<ConfirmationPopupComponent>,
    ) {}

    confirm() {
        this.dialogRef.close(true);
    }
}
