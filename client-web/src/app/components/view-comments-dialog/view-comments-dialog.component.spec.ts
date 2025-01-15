import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ViewCommentsDialogComponent } from './view-comments-dialog.component';

describe('ViewCommentsDialogComponent', () => {
    let component: ViewCommentsDialogComponent;
    let fixture: ComponentFixture<ViewCommentsDialogComponent>;

    beforeEach(() => {
        TestBed.configureTestingModule({
            declarations: [ViewCommentsDialogComponent],
        });
        fixture = TestBed.createComponent(ViewCommentsDialogComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
