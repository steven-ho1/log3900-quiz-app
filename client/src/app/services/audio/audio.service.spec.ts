import { TestBed } from '@angular/core/testing';
import { AudioService } from './audio.service';

describe('AudioService', () => {
    let audioCollectionMock: string[];
    let service: AudioService;

    beforeEach(() => {
        audioCollectionMock = ['sims4-enraged.mp3', 'sims4-very-tense.mp3'];
        TestBed.configureTestingModule({});
        service = TestBed.inject(AudioService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('play should load and play the audio', () => {
        const loadSPy = spyOn(service['audio'], 'load');
        const playSPy = spyOn(service['audio'], 'play');
        service.play(audioCollectionMock);
        expect(loadSPy).toHaveBeenCalled();
        expect(playSPy).toHaveBeenCalled();
    });

    it('pause should pause the audio', () => {
        const pauseSPy = spyOn(service['audio'], 'pause');
        service.pause();
        expect(pauseSPy).toHaveBeenCalled();
    });
});
