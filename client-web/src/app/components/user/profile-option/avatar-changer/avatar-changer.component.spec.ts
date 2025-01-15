import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AvatarChangerComponent } from './avatar-changer.component';

describe('AvatarChangerComponent', () => {
    let component: AvatarChangerComponent;
    let fixture: ComponentFixture<AvatarChangerComponent>;

    beforeEach(() => {
        TestBed.configureTestingModule({
            declarations: [AvatarChangerComponent],
        });
        fixture = TestBed.createComponent(AvatarChangerComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
