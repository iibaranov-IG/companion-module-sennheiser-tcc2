const SSC_PORT = 45

function subscribeMessage(lifetimeSeconds = 120) {
	return JSON.stringify({
		osc: {
			state: {
				subscribe: [
					{
						'#': { lifetime: lifetimeSeconds },
						m: { beam: { azimuth: null, elevation: null } },
						audio: { room_in_use: null, mute: null },
					},
				],
			},
		},
	})
}

function queryMessage() {
	return JSON.stringify({
		device: { identity: { product: null, version: null, serial: null } },
		m: { beam: { azimuth: null, elevation: null } },
		audio: { room_in_use: null, mute: null },
	})
}

function muteMessage(muted) {
	return JSON.stringify({ audio: { mute: Boolean(muted) } })
}

function parseSscMessage(raw) {
	let body
	try {
		body = JSON.parse(String(raw))
	} catch {
		return null
	}
	if (!body || typeof body !== 'object' || Array.isArray(body)) return null

	const beam = record(record(body.m).beam)
	const audio = record(body.audio)
	const identity = record(record(body.device).identity)
	const result = { valid: true, subscriptionExpired: JSON.stringify(body.osc || {}).includes('310') }

	if ('azimuth' in beam) result.azimuth = finiteNumber(beam.azimuth)
	if ('elevation' in beam) result.elevation = finiteNumber(beam.elevation)
	if ('room_in_use' in audio && typeof audio.room_in_use === 'boolean') result.roomInUse = audio.room_in_use
	if ('mute' in audio && typeof audio.mute === 'boolean') result.muted = audio.mute
	if (typeof identity.product === 'string') result.product = identity.product
	if (typeof identity.version === 'string') result.firmware = identity.version
	if (typeof identity.serial === 'string') result.serial = identity.serial
	return result
}

function azimuthInRange(azimuth, minimum, maximum) {
	if (!Number.isFinite(azimuth) || !Number.isFinite(minimum) || !Number.isFinite(maximum)) return false
	const angle = normalizeAngle(azimuth)
	const start = normalizeAngle(minimum)
	const end = normalizeAngle(maximum)
	return start <= end ? angle >= start && angle <= end : angle >= start || angle <= end
}

function normalizeAngle(value) {
	return ((Number(value) % 360) + 360) % 360
}

function finiteNumber(value) {
	return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function record(value) {
	return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

module.exports = { SSC_PORT, subscribeMessage, queryMessage, muteMessage, parseSscMessage, azimuthInRange }
