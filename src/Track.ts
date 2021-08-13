import { TrackData } from './types/types';

export default class Track {
    url: string
    title: string
    thumbnail: string
    duration: number
    author: string
    created_at: string
    extractor: string
    initial: boolean
    config?: {
        encoder_args?: string[];
        volume?: number;
    }
    requested_by?: string

    constructor(data: TrackData) {
        this.url = data.url;
        this.title = data.title;
        this.thumbnail = data.thumbnail;
        this.duration = data.duration;
        this.author = data.author;
        this.created_at = data.created_at;
        this.extractor = data.extractor;
        this.initial = data.initial;
        this.config = data.config;
    }
}
