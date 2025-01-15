import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AvatarSelectorComponent } from './avatar-selector.component';

describe('AvatarSelectorComponent', () => {
    let component: AvatarSelectorComponent;
    let fixture: ComponentFixture<AvatarSelectorComponent>;

    beforeEach(() => {
        TestBed.configureTestingModule({
            declarations: [AvatarSelectorComponent],
        });
        fixture = TestBed.createComponent(AvatarSelectorComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
