import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateChannelDialogComponent } from './create-channel-dialog.component';

describe('CreateChannelDialogComponent', () => {
    let component: CreateChannelDialogComponent;
    let fixture: ComponentFixture<CreateChannelDialogComponent>;

    beforeEach(() => {
        TestBed.configureTestingModule({
            declarations: [CreateChannelDialogComponent],
        });
        fixture = TestBed.createComponent(CreateChannelDialogComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
