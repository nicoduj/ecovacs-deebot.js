const Ecovacs = require('./ecovacs');
const tools = require('./tools');
const Element = require('ltx').Element;
const dictionary = require('./ecovacsConstants_non950type.js');

class EcovacsXMPP extends Ecovacs {
    constructor(bot, user, hostname, resource, secret, continent, country, vacuum, server_address, server_port = 5223) {
        super(bot, user, hostname, resource, secret, continent, country, vacuum, server_address, server_port);

        this.iqElementId = 1;
        this.pingInterval = null;

        this.simpleXmpp = require('simple-xmpp');

        this.simpleXmpp.on('online', (event) => {
            tools.envLog('[EcovacsXMPP] Session start');
            this.session_start(event);
        });

        this.simpleXmpp.on('close', () => {
            tools.envLog('[EcovacsXMPP] Session disconnected');
            this.emit('closed');
        });

        this.simpleXmpp.on('stanza', (stanza) => {
            tools.envLog('[EcovacsXMPP] stanza: %s', stanza.toString());
            if (stanza.name === 'iq' && (stanza.attrs.type === 'set' || stanza.attrs.type === 'result') && !!stanza.children[0] && stanza.children[0].name === 'query' && !!stanza.children[0].children[0]) {
                let firstChild = stanza.children[0];
                tools.envLog('[EcovacsXMPP] firstChild: %s', firstChild.toString());
                let secondChild = firstChild.children[0];
                tools.envLog('[EcovacsXMPP] secondChild: %s', secondChild.toString());
                let command = secondChild.attrs.td;
                if (!command) {
                    if (secondChild.children[0]) {
                        if (secondChild.children[0].name) {
                            command = secondChild.children[0].name;
                        }
                    }
                    if (secondChild.attrs.hasOwnProperty('type')) {
                        if (dictionary.COMPONENT_FROM_ECOVACS[secondChild.attrs.type]) {
                            command = 'LifeSpan';
                        }
                    }
                    if (secondChild.attrs.hasOwnProperty('v')) {
                        let waterLevel = parseInt(secondChild.attrs.v);
                        if ((waterLevel >= 1) && (waterLevel <= 4)) {
                            command = 'WaterLevel';
                        }
                    }
                    if (secondChild.attrs.hasOwnProperty('on')) {
                        let id = parseInt(secondChild.attrs.id);
                        if ((id >= 999999990) && (id <= 999999992)) {
                            command = 'GetOnOff';
                        } else {
                            command = 'WaterBoxInfo';
                        }
                    }
                    if ((secondChild.attrs.hasOwnProperty('p')) && (secondChild.attrs.hasOwnProperty('a'))) {
                        if (secondChild.attrs.id === "999999999") {
                            command = 'ChargePosition';
                        }
                        else {
                            command = 'DeebotPosition';
                        }
                    }
                    if ((secondChild.attrs.hasOwnProperty('st'))) {
                        if (secondChild.attrs.id === "999999997") {
                            command = 'SleepStatus';
                        }
                    }
                    if ((secondChild.attrs.hasOwnProperty('a')) && (secondChild.attrs.hasOwnProperty('l')) && (secondChild.attrs.hasOwnProperty('c'))) {
                        command = 'CleanSum';
                    }
                    if ((secondChild.attrs.hasOwnProperty('i')) && (secondChild.attrs.hasOwnProperty('m'))) {
                        let id = parseInt(secondChild.attrs.id);
                        if (id === 999999998) {
                            command = 'MapP';
                        }
                    }
                    if (secondChild.attrs.hasOwnProperty('tp')) {
                        let id = parseInt(secondChild.attrs.id);
                        if (id === 999999996) {
                            command = 'MapSet';
                        }
                    }
                    if ((secondChild.attrs.hasOwnProperty('m'))) {
                        let id = parseInt(secondChild.attrs.id);
                        if ((id >= 999999900) && (id <= 999999979)) {
                            command = 'PullM';
                        }
                    }
                    if ((secondChild.children[0]) && (secondChild.children[0].name === 'CleanSt')) {
                        command = 'CleanLogs';
                    }
                }
                if (command) {
                    switch (tools.getEventNameForCommandString(command)) {
                        case "MapP":
                            let mapinfo = this.bot._handle_mapP(secondChild);
                            if (mapinfo) {
                                this.emit("CurrentMapName", this.bot.currentMapName);
                                this.emit("CurrentMapMID", this.bot.currentMapMID);
                                this.emit("CurrentMapIndex", this.bot.currentMapIndex);
                                this.emit("Maps", this.bot.maps);
                            }
                            break;
                        case "MapSet":
                            let mapset = this.bot._handle_mapSet(secondChild);
                            if (mapset["mapsetEvent"] !== 'error') {
                                this.emit(mapset["mapsetEvent"], mapset["mapsetData"]);
                            }
                            break;
                        case "PullM":
                            let mapsubset = this.bot._handle_pullM(secondChild);
                            if (mapsubset && (mapsubset["mapsubsetEvent"] !== 'error')) {
                                this.emit(mapsubset["mapsubsetEvent"], mapsubset["mapsubsetData"]);
                            }
                            break;
                        case 'ChargeState':
                            this.bot._handle_chargeState(secondChild.children[0]);
                            this.emit('ChargeState', this.bot.chargeStatus);
                            break;
                        case 'BatteryInfo':
                            this.bot._handle_batteryInfo(secondChild.children[0]);
                            this.emit('BatteryInfo', this.bot.batteryInfo);
                            break;
                        case 'CleanReport':
                            this.bot._handle_cleanReport(secondChild.children[0]);
                            this.emit('CleanReport', this.bot.cleanReport);
                            if (this.bot.lastUsedAreaValues) {
                                tools.envLog('[EcovacsXMPP] LastUsedAreaValues: %s', this.bot.lastUsedAreaValues);
                                this.emit("LastUsedAreaValues", this.bot.lastUsedAreaValues);
                            }
                            break;
                        case "CleanSpeed":
                            this.bot._handle_cleanSpeed(secondChild.children[0]);
                            this.emit("CleanSpeed", this.bot.cleanSpeed);
                            break;
                        case 'Error':
                            this.bot._handle_error(secondChild.attrs);
                            this.emit('Error', this.bot.errorDescription);
                            this.emit('ErrorCode', this.bot.errorCode);
                            break;
                        case 'LifeSpan':
                            this.bot._handle_lifeSpan(secondChild.attrs);
                            const component = dictionary.COMPONENT_FROM_ECOVACS[secondChild.attrs.type];
                            if (component) {
                                if (this.bot.components[component]) {
                                    this.emit('LifeSpan_' + component, this.bot.components[component]);
                                }
                            }
                            break;
                        case 'WaterLevel':
                            this.bot._handle_waterLevel(secondChild);
                            this.emit('WaterLevel', this.bot.waterLevel);
                            break;
                        case 'WaterBoxInfo':
                            this.bot._handle_waterboxInfo(secondChild);
                            this.emit('WaterBoxInfo', this.bot.waterboxInfo);
                            break;
                        case 'DustCaseST':
                            this.bot._handle_dustcaseInfo(secondChild);
                            this.emit('DustCaseInfo', this.bot.dustcaseInfo);
                            break;
                        case 'DeebotPosition':
                            this.bot._handle_deebotPosition(secondChild);
                            if (this.bot.deebotPosition["x"] && this.bot.deebotPosition["y"]) {
                                this.emit('DeebotPosition', this.bot.deebotPosition["x"] + "," + this.bot.deebotPosition["y"] + "," + this.bot.deebotPosition["a"]);
                                this.emit("DeebotPositionCurrentSpotAreaID", this.bot.deebotPosition["currentSpotAreaID"]);
                            }
                            break;
                        case 'ChargePosition':
                            this.bot._handle_chargePosition(secondChild);
                            this.emit('ChargePosition', this.bot.chargePosition["x"]+","+this.bot.chargePosition["y"]+","+this.bot.chargePosition["a"]);
                            break;
                        case 'NetInfo':
                            this.bot._handle_netInfo(secondChild.attrs);
                            this.emit("NetInfoIP", this.bot.netInfoIP);
                            this.emit("NetInfoWifiSSID", this.bot.netInfoWifiSSID);
                            break;
                        case 'SleepStatus':
                            this.bot._handle_sleepStatus(secondChild);
                            this.emit("SleepStatus", this.bot.sleepStatus);
                            break;
                        case 'CleanSum':
                            this.bot._handle_cleanSum(secondChild);
                            this.emit("CleanSum_totalSquareMeters", this.bot.cleanSum_totalSquareMeters);
                            this.emit("CleanSum_totalSeconds", this.bot.cleanSum_totalSeconds);
                            this.emit("CleanSum_totalNumber", this.bot.cleanSum_totalNumber);
                            break;
                        case 'CleanLogs':
                            tools.envLog("[EcovacsXMPP] Logs: %s", JSON.stringify(secondChild));
                            this.bot._handle_cleanLogs(secondChild);
                            let cleanLog = [];
                            for (let i in this.bot.cleanLog) {
                                if (this.bot.cleanLog.hasOwnProperty(i)) {
                                    cleanLog.push(this.bot.cleanLog[i]);
                                    tools.envLog("[EcovacsXMPP] Logs: %s", JSON.stringify(this.bot.cleanLog[i]));
                                }
                            }
                            if (cleanLog.length) {
                                this.emit("CleanLog", cleanLog);
                            }
                            break;
                        case 'GetOnOff':
                            this.bot._handle_onOff(secondChild);
                            if (this.bot.doNotDisturbEnabled) {
                                this.emit("DoNotDisturbEnabled", this.bot.doNotDisturbEnabled);
                            }
                            if (this.bot.continuousCleaningEnabled) {
                                this.emit("ContinuousCleaningEnabled", this.bot.continuousCleaningEnabled);
                            }
                            if (this.bot.voiceReportDisabled) {
                                this.emit("VoiceReportDisabled", this.bot.voiceReportDisabled);
                            }
                            break;
                        case 'SetOnOff':
                            tools.envLog("[EcovacsXMPP] SetOnOff: %s", JSON.stringify(secondChild));
                            break;
                        default:
                            tools.envLog('[EcovacsXMPP] Unknown response type received: %s', JSON.stringify(stanza));
                            break;
                    }
                }
                else {
                    tools.envLog('[EcovacsXMPP] Unknown response type received: %s', JSON.stringify(stanza));
                }
            } else if (stanza.name === 'iq' && stanza.attrs.type === 'error' && !!stanza.children[0] && stanza.children[0].name === 'error' && !!stanza.children[0].children[0]) {
                tools.envLog('[EcovacsXMPP] Response Error for request %s: %S', stanza.attrs.id, JSON.stringify(stanza.children[0]));
                this.bot._handle_error(stanza.children[0].attrs);
                this.emit('Error', this.bot.errorDescription);
                this.emit('ErrorCode', this.bot.errorCode);
            }
        });

        this.simpleXmpp.on('error', (e) => {
            tools.envLog('[EcovacsXMPP] Error:', e);
        });
    }

    connect() {
        tools.envLog('[EcovacsXMPP] Connecting as %s to %s', this.user + '@' + this.hostname, this.server_address + ':' + this.server_port);
        this.simpleXmpp.connect({
            jid: this.user + '@' + this.hostname,
            password: '0/' + this.resource + '/' + this.secret,
            host: this.server_address,
            port: this.server_port
        });

        if (!this.pingInterval) {
            this.pingInterval = setInterval(() => {
                this.sendPing(this.bot.vacuumAddress());
            }, 30000);
        }

        this.on('ready', (event) => {
            tools.envLog('[EcovacsMQTT] received ready event');
            this.sendPing(this.bot.vacuumAddress());
        });
    }

    sendCommand(xml, recipient) {
        let result = this.wrap_command(xml, recipient);
        tools.envLog('[EcovacsXMPP] Sending xml:', result.toString());
        this.simpleXmpp.conn.send(result);
    }

    wrap_command(xml, recipient) {
        let id = this.iqElementId++;
        let iqElement = new Element('iq', {
            id: id,
            to: recipient,
            from: this.getMyAddress(),
            type: 'set'
        });
        iqElement.c('query', {
            xmlns: 'com:ctl'
        }).cnode(xml);
        return iqElement;
    }

    getMyAddress() {
        return this.user + '@' + this.hostname + '/' + this.resource;
    }

    sendPing(to) {
        let id = this.iqElementId++;
        let e = new Element('iq', {
            id: id,
            to: to,
            from: this.getMyAddress(),
            type: 'get'
        });
        e.c('query', {
            xmlns: 'urn:xmpp:ping'
        });
        this.simpleXmpp.conn.send(e);
    }

    disconnect() {
        this.simpleXmpp.disconnect();
        clearInterval(this.pingInterval);
        this.pingInterval = null;
        tools.envLog("[EcovacsXMPP] Closed XMPP Client");
    }
}

module.exports = EcovacsXMPP;
