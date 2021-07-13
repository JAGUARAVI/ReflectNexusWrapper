import EventEmitter from "events";
import * as Constants from './Constants';
import Nexus from "./Nexus";
import { TrackData, LoopMode, Latency, PlayerConstructOptions, QueueState, QueueStateUpdate } from './types/types'
import { Message, Interaction, Guild, TextChannel, VoiceChannel } from 'discord.js'

class Player extends EventEmitter {
    public tracks: Array<TrackData>
    public manager: Nexus
    public source: Message | Interaction

    public connected: boolean
    private subscription: boolean

    public volume: number
    public paused: boolean
    public loop_mode: LoopMode

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

        // @ts-ignore
        this.voiceChannel = options.source.member.voice?.channel;
        // @ts-ignore
        this.channel = options.source.channel;

        this.source = options.source;

        this.streamTime = 0;
        this.volume = 100;              //todo: add support for predefined options.volume
        this.paused = false;            //todo: add support for predefined options.paused
        this.loop_mode = LoopMode.OFF;   //todo: add support for predefined options.loop_mode

        if (options.connect !== false) this.connect(this.source);
    }

    async connect(source?: Message | Interaction, voiceChannel?: VoiceChannel): Promise<void> {
        // @ts-ignore
        if (source?.member?.voice?.channel || voiceChannel) this.voiceChannel = voiceChannel || source.member?.voice?.channel;
        // @ts-ignore
        if (source.channel) this.channel = source.channel;

        if (source) this.source = source;

        this.subscription = await this.getSubscription();
        if (!this.subscription) this.subscription = await this.createSubscription().then(() => true).catch((e) => { throw new Error('Error connecting to the voice channel!\n' + e) })
        
        this.connected = true;
        this.emit(Constants.Events.READY);
    }

    async stop(): Promise<void> {
        this.connected = false;
        await this.destroySubscription();
    }

    async play(query: string, now = false): Promise<TrackData> { //todo: add search (list all tracks [max-10] and ask to pick any one)
        return new Promise(async (res, rej) => {
            if (!this.connected) await this.connect();
            if (!query) return rej("No query provided!");

            const tracks = await this.manager.search(query).then(a => a.results)

            if (!tracks.length) {
                this.manager.emit(Constants.Events.NO_RESULTS, this, query);
                this.emit(Constants.Events.NO_RESULTS, query)
            }

            await this._playTracks(tracks[0], now).then(t => res(t[0])).catch(rej);
        })
    }

    async skip(): Promise<TrackData> {
        return await new Promise(async (res, rej) => {
            if (!this.connected) return rej("No tracks playing to skip!");
            if (!this.tracks.length) return rej("No tracks playing to skip!")

            await this.manager.DELETE(`/api/player/${this.guild.id}`);

            this.once(Constants.Events.TRACK_FINISH, (t: TrackData) => res(t))
            this.once(Constants.Events.TRACK_ERROR, (e) => rej(e))
        })
    }

    async pause(): Promise<QueueState> {
        return await new Promise(async (res, rej) => {
            if (!this.connected) return rej("No track playing!");
            if (!this.tracks.length) return rej("No track playing!");

            if (this.paused) return rej("Player is already paused!");

            await this.manager.PATCH(`/api/player/${this.guild.id}`, {
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

            await this.manager.PATCH(`/api/player/${this.guild.id}`, {
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

    async setVolume(volume: number) {
        return await new Promise(async (res, rej) => {
            if (!this.connected) return rej("Player is not connected!");

            if (volume < 0 || volume > 125) return rej("Volume can't be below 0 or above 125!");

            await this.manager.PATCH(`/api/player/${this.guild.id}`, {
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

    async setLoopMode(mode: LoopMode): Promise<QueueState> {
        return await new Promise(async (res, rej) => {
            if (!this.connected) return rej("Player is not connected!");

            await this.manager.PATCH(`/api/player/${this.guild.id}`, {
                data: {
                    loop_mode: mode
                }
            });

            this.once(Constants.Events.QUEUE_STATE_UPDATE, (state: QueueStateUpdate) => {
                this.loop_mode = state.new_state.loop_mode;
                res(state.new_state);
            });
        });
    }

    async _playTracks(tracks: TrackData | TrackData[], now = false): Promise<TrackData[]> {
        return new Promise(async (res, rej) => {
            if (!this.connected) await this.connect(this.source);
            if (!tracks) return rej("No tracks provided!");

            if (!Array.isArray(tracks)) tracks = [tracks];
            if (now) tracks.map(t => Object.assign({}, t, { initial: true }));

            let result = await this.manager.POST(`/api/player/${this.guild.id}`, {
                tracks: tracks
            });

            if (result.error) rej(result.error);

            this.once(Constants.Events.TRACK_START, (t: TrackData) => res([t]));
            this.once(Constants.Events.TRACK_ADD, (t: TrackData) => res([t]));
            this.once(Constants.Events.TRACKS_ADD, (t: TrackData[]) => res(t));
            this.once(Constants.Events.TRACK_ERROR, (e) => rej(e));
        })
    }

    async getSubscription(): Promise<boolean> {
        const subscription = await this.manager.GET(`/api/subscription/${this.guild.id}/${this.voiceChannel.id}`);
        if (subscription.error) return false;
        return true;
    }

    async createSubscription(): Promise<any> {
        return new Promise(async (res, rej) => {
            const subscription = await this.manager.POST(`/api/subscription/${this.guild.id}/${this.voiceChannel.id}`);
            if (subscription.error) rej(subscription.error);
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