const { InstanceBase, InstanceStatus, Regex, UDPHelper, combineRgb } = require('@companion-module/base')
const {
	SSC_PORT,
	subscribeMessage,
	queryMessage,
	muteMessage,
	parseSscMessage,
	azimuthInRange,
} = require('./ssc-protocol')

class Tcc2Instance extends InstanceBase {
	constructor(internal) {
		super(internal)
		this.state = { azimuth: null, elevation: null, roomInUse: null, muted: null, product: '', firmware: '', serial: '' }
	}

	async init(config) {
		this.config = config
		this.setDefinitions()
		this.connect()
	}

	async configUpdated(config) {
		this.config = config
		this.connect()
	}

	async destroy() {
		this.stopTimers()
		this.udp?.destroy()
	}

	connect() {
		this.stopTimers()
		this.udp?.destroy()

		const host = String(this.config.host || '').trim()
		const port = Number(this.config.port || SSC_PORT)
		if (!host || !Number.isInteger(port) || port < 1 || port > 65535) {
			this.updateStatus(InstanceStatus.BadConfig, 'Enter the TCC2 IP address and SSC port')
			return
		}

		this.updateStatus(InstanceStatus.Connecting)
		this.lastMessageAt = Date.now()
		this.udp = new UDPHelper(host, port)
		this.udp.on('error', (error) => this.updateStatus(InstanceStatus.ConnectionFailure, error.message))
		this.udp.on('data', (data) => this.handleMessage(data))
		this.udp.on('listening', () => {
			this.subscribe()
			this.query()
			this.startTimers()
		})
	}

	startTimers() {
		this.stopTimers()
		const pollSeconds = Math.max(5, Math.min(300, Number(this.config.pollInterval || 30)))
		this.queryTimer = setInterval(() => this.query(), pollSeconds * 1000)
		this.subscribeTimer = setInterval(() => this.subscribe(), 60 * 1000)
		this.watchdogTimer = setInterval(() => {
			const silentSeconds = Math.round((Date.now() - this.lastMessageAt) / 1000)
			if (silentSeconds > Math.max(15, pollSeconds * 2)) {
				this.updateStatus(InstanceStatus.ConnectionFailure, `No SSC reply for ${silentSeconds} seconds`)
			}
		}, 5000)
	}

	stopTimers() {
		for (const timer of [this.queryTimer, this.subscribeTimer, this.watchdogTimer]) if (timer) clearInterval(timer)
		delete this.queryTimer
		delete this.subscribeTimer
		delete this.watchdogTimer
	}

	send(payload) {
		if (!this.udp || this.udp.isDestroyed) throw new Error('TCC2 UDP socket is not ready')
		this.udp.send(payload)
	}

	subscribe() {
		this.send(subscribeMessage(120))
	}

	query() {
		this.send(queryMessage())
	}

	handleMessage(data) {
		const update = parseSscMessage(data.toString('utf8'))
		if (!update) {
			this.log('debug', 'Ignored malformed SSC datagram')
			return
		}
		if (update.protocolError) {
			this.updateStatus(InstanceStatus.ConnectionFailure, 'SSC request rejected by device')
			return
		}
		if (
			!['azimuth', 'elevation', 'roomInUse', 'muted', 'product', 'firmware', 'serial'].some(
				(key) => Object.prototype.hasOwnProperty.call(update, key) && update[key] !== null,
			)
		)
			return
		this.lastMessageAt = Date.now()

		for (const key of ['azimuth', 'elevation', 'roomInUse', 'muted', 'product', 'firmware', 'serial']) {
			if (Object.prototype.hasOwnProperty.call(update, key)) this.state[key] = update[key]
		}

		this.setVariableValues({
			beam_azimuth: valueOrBlank(this.state.azimuth),
			beam_elevation: valueOrBlank(this.state.elevation),
			room_in_use: boolOrBlank(this.state.roomInUse),
			muted: boolOrBlank(this.state.muted),
			product: this.state.product,
			firmware: this.state.firmware,
			serial: this.state.serial,
			last_update: new Date().toISOString(),
		})
		this.checkFeedbacks('room_in_use', 'muted', 'azimuth_sector')
		this.updateStatus(InstanceStatus.Ok)
	}

	setDefinitions() {
		this.setActionDefinitions({
			refresh: { name: 'Refresh TCC2 state', options: [], callback: () => this.query() },
			set_mute: {
				name: 'Mute or unmute microphone',
				options: [{ type: 'checkbox', id: 'muted', label: 'Muted', default: true }],
				callback: (action) => this.send(muteMessage(action.options.muted)),
			},
		})

		this.setFeedbackDefinitions({
			room_in_use: {
				type: 'boolean',
				name: 'Room is in use',
				description: 'The TCC2 currently detects an active talker',
				defaultStyle: { bgcolor: combineRgb(0, 130, 0), color: combineRgb(255, 255, 255) },
				options: [],
				callback: () => this.state.roomInUse === true,
			},
			muted: {
				type: 'boolean',
				name: 'Microphone is muted',
				description: 'The mute state reported by the TCC2',
				defaultStyle: { bgcolor: combineRgb(180, 0, 0), color: combineRgb(255, 255, 255) },
				options: [],
				callback: () => this.state.muted === true,
			},
			azimuth_sector: {
				type: 'boolean',
				name: 'Beam is inside azimuth sector',
				description:
					'Use with Room is in use to trigger a camera preset. Wrapped sectors such as 330°–30° are supported.',
				defaultStyle: { bgcolor: combineRgb(0, 80, 180), color: combineRgb(255, 255, 255) },
				options: [angleOption('minimum', 'Sector start'), angleOption('maximum', 'Sector end', 90)],
				callback: (feedback) =>
					azimuthInRange(this.state.azimuth, Number(feedback.options.minimum), Number(feedback.options.maximum)),
			},
		})

		this.setVariableDefinitions([
			{ variableId: 'beam_azimuth', name: 'Active beam azimuth (degrees)' },
			{ variableId: 'beam_elevation', name: 'Active beam elevation (degrees)' },
			{ variableId: 'room_in_use', name: 'Room in use' },
			{ variableId: 'muted', name: 'Microphone muted' },
			{ variableId: 'product', name: 'Device product' },
			{ variableId: 'firmware', name: 'Device firmware' },
			{ variableId: 'serial', name: 'Device serial number' },
			{ variableId: 'last_update', name: 'Last SSC update (UTC)' },
		])
	}

	getConfigFields() {
		return [
			{
				type: 'static-text',
				id: 'info',
				label: 'Sennheiser SSCv1',
				value:
					'The TCC2 uses JSON over UDP. Allow bidirectional UDP traffic between Companion and port 45 on the microphone.',
				width: 12,
			},
			{ type: 'textinput', id: 'host', label: 'TCC2 IP address', regex: Regex.IP, width: 8 },
			{ type: 'textinput', id: 'port', label: 'SSC UDP port', default: '45', regex: Regex.PORT, width: 4 },
			{
				type: 'number',
				id: 'pollInterval',
				label: 'Fallback refresh interval (seconds)',
				default: 30,
				min: 5,
				max: 300,
				width: 6,
			},
		]
	}
}

function angleOption(id, label, defaultValue = 0) {
	return { type: 'number', id, label, default: defaultValue, min: 0, max: 359, step: 1 }
}

function valueOrBlank(value) {
	return value === null || value === undefined ? '' : String(value)
}

function boolOrBlank(value) {
	return typeof value === 'boolean' ? String(value) : ''
}

module.exports = Tcc2Instance
