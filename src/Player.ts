import EventEmitter from "events";
import * as Constants from './Constants';
import Nexus from './Nexus';
import Track from './Track';

import { TrackData, LoopMode, Latency, PlayerConstructOptions, QueueState, QueueStateUpdate, PlayMetaData, QueueFilters, FiltersName } from './types/types'
import { Message, Interaction, Guild, TextChannel, VoiceChannel } from 'discord.js'

class Player extends EventEmitter {
    public tracks: Array<Track>
    public requestQueue: Array<TrackData>
    public manager: Nexus
    public source: Message | Interaction

    public connected: boolean
    private connecting: boolean

    public volume: number
    public paused: boolean
    public loopMode: LoopMode
    public filters: QueueFilters

    public streamTime: number
    public updateTimestamp: Date
    public latency: Latency

    public guild: Guild
    public channel: TextChannel
    public voiceChannel: VoiceChannel

    constructor(options: PlayerConstructOptions) {
        super();

        this.manager = options.manager;
        this.manager.GET = this.manager.GET.bind(this.manager);
        this.manager.POST = this.manager.POST.bind(this.manager);
        this.manager.PATCH = this.manager.PATCH.bind(this.manager);
        this.manager.DELETE = this.manager.DELETE.bind(this.manager);

        this.connected = false;
        this.guild = options.source.guild;

        this.tracks = [];
        this.requestQueue = [];

        // @ts-ignore
        this.voiceChannel = options.source.member.voice?.channel;
        // @ts-ignore
        this.channel = options.source.channel;

        this.source = options.source;

        this.streamTime = 0;
        this.volume = 100;              //todo: add support for predefined options.volume
        this.paused = false;            //todo: add support for predefined options.paused
        this.loopMode = LoopMode.OFF;   //todo: add support for predefined options.loopMode

        this.filters = {};
        for (const filter of this.manager.filters) {
            this.filters[filter.name] = false;
        };

        if (options.connect !== false) this.connect(this.source, this.voiceChannel);
    }

    get encoderArgs(): Array<string> {
        let arr = [];
        
        for (const filter of this.manager.filters){
            if(this.filters[filter.name] == true) arr.push(filter.value);
        }

        return arr.length ? ['-af', arr.join(',')] : [];
    }

    async connect(source?: Message | Interaction, voiceChannel?: VoiceChannel): Promise<void> {
        if (this.connecting == true) {
            return new Promise((res, rej) => {
                this.once(Constants.Events.VOICE_CONNECTION_READY, (d) => {
                    this.connecting = false;
                    res(d);
                })
                this.once(Constants.Events.VOICE_CONNECTION_ERROR, (d) => rej(d))
            })
        } else {
            this.connecting = true;
            return new Promise(async (res, rej) => {
                // @ts-ignore
                if (source?.member?.voice?.channel || voiceChannel) this.voiceChannel = voiceChannel || source.member?.voice?.channel;
                // @ts-ignore
                if (source?.channel) this.channel = source.channel;

                if (source) this.source = source;

                await this.createSubscription().then(() => {
                    this.connecting = false;
                    this.connected = true;
                    res();
                }).catch((e) => rej(e));
            })
        }
    }

    async stop(): Promise<void> {
        this.connected = false;
        return await this.destroySubscription();
    }

    async play(query: string, data?: PlayMetaData): Promise<Track> { //todo: add search (list all tracks [max-10] and ask to pick any one)
        return new Promise(async (res, rej) => {
            if (!this.connected) await this.connect();
            if (!query) return rej("No query provided!");

            const tracks = await this.manager.search(query).then(a => a.results.map(r => new Track(r)));

            if (!tracks.length) {
                this.manager.emit(Constants.Events.NO_RESULTS, this, query);
                this.emit(Constants.Events.NO_RESULTS, query);
                return rej(Constants.Events.NO_RESULTS);
            }

            if (this.tracks.length > 0) {
                const track = new Track(tracks[0])
                if (data?.source?.member?.user?.id) track.requested_by = data.source.member.user.id;

                this.tracks.push(track);
                this.manager.emit(Constants.Events.TRACK_ADD, this, track)
                this.emit(Constants.Events.TRACK_ADD, track);

                return res(track);
            }

            await this._playTrack(tracks[0], data).then(t => res(t)).catch(rej);
        })
    }

    async skip(): Promise<Track> {
        return await new Promise(async (res, rej) => {
            if (!this.connected) return rej("No tracks playing to skip!");
            if (!this.tracks.length) return rej("No tracks playing to skip!")

            this.manager.DELETE(`/api/player/${this.guild.id}`);

            this.once(Constants.Events.TRACK_FINISH, (t: Track) => {
                this.tracks.shift();
                res(t);
            });
            this.once(Constants.Events.TRACK_ERROR, (e) => rej(e))
        })
    }

    async seek(time: number): Promise<QueueState> {
        return new Promise((res, rej) => {
            const track = this.tracks[0];
            if (!track) return rej("No track is playing!");
            if (time > track.duration) return rej('Seek time cannot be greater than the track duration!');

            this.manager.PATCH(`/api/player/${this.guild.id}`, {
                data: {
                    encoder_args: ['-ss', (time/1000), ...this.encoderArgs]
                }
            });

            this.once(Constants.Events.QUEUE_STATE_UPDATE, (state: QueueStateUpdate) => {
                this.streamTime = time;
                res(state.new_state);
            });
        });
    }

    async filter(filter: FiltersName): Promise<QueueState | void> {
        return new Promise((res, rej) => {
            if(!this.manager.filters[filter]) return rej("Unknown filter!");
            this.filters[filter] = this.filters[filter] == false; 

            if (!this.tracks.length) res();

            this.manager.PATCH(`/api/player/${this.guild.id}`, {
                data: {
                    encoder_args: ['-ss', (this.streamTime/1000) + 3, ...this.encoderArgs]
                }
            });

            this.once(Constants.Events.QUEUE_STATE_UPDATE, (state: QueueStateUpdate) => {
                this.paused = state.new_state.paused;
                res(state.new_state);
            });
        });
    }

    async pause(): Promise<QueueState> {
        return await new Promise(async (res, rej) => {
            if (!this.connected) return rej("No track playing!");
            if (!this.tracks.length) return rej("No track playing!");

            if (this.paused) return rej("Player is already paused!");

            this.manager.PATCH(`/api/player/${this.guild.id}`, {
                data: {
                    paused: true
                }
            });

            this.once(Constants.Events.QUEUE_STATE_UPDATE, (state: QueueStateUpdate) => {
                this.paused = state.new_state.paused;
                res(state.new_state);
            });
        });
    }

    async resume(): Promise<QueueState> {
        return await new Promise(async (res, rej) => {
            if (!this.connected) return rej("No track playing!");
            if (!this.tracks.length) return rej("No track playing!");

            if (!this.paused) return rej("Player is already resumed!");

            this.manager.PATCH(`/api/player/${this.guild.id}`, {
                data: {
                    paused: false
                }
            });

            this.once(Constants.Events.QUEUE_STATE_UPDATE, (state: QueueStateUpdate) => {
                this.paused = state.new_state.paused;
                res(state.new_state);
            });
        });
    }

    async setVolume(volume: number): Promise<QueueState> {
        return await new Promise(async (res, rej) => {
            if (!this.connected) return rej("Player is not connected!");

            if (volume < 0 || volume > 125) return rej("Volume can't be below 0 or above 125!");

            this.manager.PATCH(`/api/player/${this.guild.id}`, {
                data: {
                    volume: volume
                }
            });

            this.on(Constants.Events.QUEUE_STATE_UPDATE, (state: QueueStateUpdate) => {
                this.volume = state.new_state.volume;
                res(state.new_state);
            });
        });
    }

    setLoopMode(mode: LoopMode): void {
        this.loopMode = mode;
    }

    async _playTrack(track: Track | TrackData, data?: PlayMetaData): Promise<Track> {
        return new Promise(async (res, rej) => {
            if (!this.connected) await this.connect(this.source);
            if (!track) return rej("No track provided!");

            //if (data?.now) ""; Todo: Implement this

            if (data?.volume) {
                track.config = Object.assign({}, track.config, { volume: data.volume });
                this.volume = data.volume;
            }
            else track.config = Object.assign({}, track.config, { volume: this.volume, encoder_args: this.encoderArgs });

            const trackData = Object.assign({}, track) as TrackData;
            if (data?.source?.member?.user?.id) trackData.requested_by = data.source.member.user.id;
            if (track.requested_by) trackData.requested_by = track.requested_by;

            this.requestQueue.push(trackData);

            this.manager.POST(`/api/player/${this.guild.id}`, {
                track: track
            }, false);

            this.once(Constants.Events.TRACK_START, (track: Track) => {
                res(track);
            });

            this.once(Constants.Events.TRACK_ERROR, (e: any) => rej(e));
        })
    }

    async getSubscription(): Promise<boolean> {
        const subscription = await this.manager.GET(`/api/subscription/${this.guild.id}/${this.voiceChannel.id}`);
        if (subscription.error) return false;
        return true;
    }

    async createSubscription(): Promise<any> {
        return new Promise(async (res, rej) => {
            this.manager.POST(`/api/subscription/${this.guild.id}/${this.voiceChannel.id}`).then((s: any) => {
                if (s.error) return rej(s.error);
            });
            this.once(Constants.Events.VOICE_CONNECTION_READY, (d) => res(d))
            this.once(Constants.Events.VOICE_CONNECTION_ERROR, (d) => rej(d))
        });
    }

    async destroySubscription(): Promise<void> {
        return await this.manager.DELETE(`/api/subscription/${this.guild.id}/${this.voiceChannel.id}`);
    }

    setInfo(data: any): void {
        this.streamTime = data.stream_time;
        this.latency = data.latency;
        this.updateTimestamp = new Date(data.timestamp)
    }
}

export default Player;
