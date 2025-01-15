import { Injectable } from '@angular/core';
import { AUDIO_PATH } from '@app/constants/audio';

@Injectable({
    providedIn: 'root',
})
export class AudioService {
    private audio: HTMLAudioElement = new Audio();

    constructor() {
        this.audio.volume = 1;
    }

    play(audioCollection: string[]) {
        this.audio.src = this.getRandomAudioUrl(audioCollection);
        this.audio.load();
        this.audio.play();
    }

    pause() {
        this.audio.pause();
    }

    private getRandomAudioUrl = (sounds: string[]) => {
        return AUDIO_PATH + sounds[Math.floor(Math.random() * sounds.length)];
    };
}
