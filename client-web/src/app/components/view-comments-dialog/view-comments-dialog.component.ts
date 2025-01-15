import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TOKEN } from '@app/constants/auth';
import { Feedback, Game } from '@common/game';
import { environment } from 'src/environments/environment';

@Component({
    selector: 'app-view-comments-dialog',
    templateUrl: './view-comments-dialog.component.html',
    styleUrls: ['./view-comments-dialog.component.scss'],
})
export class ViewCommentsDialogComponent {
    originalFeedback: Feedback[] = [];
    isAdmin: boolean;

    constructor(
        public dialogRef: MatDialogRef<ViewCommentsDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: { game: Game; isAdmin: boolean },
        private http: HttpClient,
    ) {
        if (!this.data.game.feedback) {
            this.data.game.feedback = [];
        }
        this.originalFeedback = JSON.parse(JSON.stringify(data.game.feedback));
    }

    closeDialog(): void {
        this.data.game.feedback = JSON.parse(JSON.stringify(this.originalFeedback));
        this.dialogRef.close();
    }

    deleteComment(index: number): void {
        if (this.data.game.feedback) {
            this.data.game.feedback.splice(index, 1);
        }
    }

    saveChanges(): void {
        const url = `${environment.serverBaseUrl}/api/games/${this.data.game.id}/comments`;
        this.http.patch(url, { feedback: this.data.game.feedback }, this.setAuthorizationHeader()).subscribe({
            next: () => {
                this.dialogRef.close({ updatedGame: this.data.game });
            },
            // error: (error: HttpErrorResponse) => {
            //     console.error('Erreur lors de la mise à jour des commentaires :', error);
            // },
        });
    }

    private setAuthorizationHeader() {
        const token = sessionStorage.getItem(TOKEN);
        const headers = new HttpHeaders({
            // eslint-disable-next-line @typescript-eslint/naming-convention
            Authorization: `Bearer ${token}`,
        });

        return { headers };
    }
}
