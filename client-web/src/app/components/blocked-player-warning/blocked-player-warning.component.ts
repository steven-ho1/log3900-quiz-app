import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

@Component({
    selector: 'app-blocked-player-warning',
    templateUrl: './blocked-player-warning.component.html',
    styleUrls: ['./blocked-player-warning.component.scss'],
})
export class BlockedPlayerWarningComponent {
    constructor(
        private dialogRef: MatDialogRef<BlockedPlayerWarningComponent>,
        @Inject(MAT_DIALOG_DATA) public data: { message: string },
    ) {}

    onCancel(): void {
        this.dialogRef.close(false);
    }

    onConfirm(): void {
        this.dialogRef.close(true);
    }
}
