const test = require('node:test')
const assert = require('node:assert/strict')
const { subscribeMessage, queryMessage, muteMessage, parseSscMessage, azimuthInRange } = require('../src/ssc-protocol')

test('subscribes to the TCC2 beam and activity paths', () => {
	const message = JSON.parse(subscribeMessage(90))
	const subscription = message.osc.state.subscribe[0]
	assert.equal(subscription['#'].lifetime, 90)
	assert.deepEqual(subscription.m.beam, { azimuth: null, elevation: null })
	assert.deepEqual(subscription.audio, { room_in_use: null, mute: null })
})

test('queries identity and current beam state', () => {
	const message = JSON.parse(queryMessage())
	assert.equal(message.device.identity.product, null)
	assert.equal(message.m.beam.azimuth, null)
	assert.equal(message.audio.room_in_use, null)
})

test('parses partial SSC replies', () => {
	assert.deepEqual(parseSscMessage('{"m":{"beam":{"azimuth":278,"elevation":43}},"audio":{"room_in_use":true}}'), {
		valid: true,
		subscriptionExpired: false,
		azimuth: 278,
		elevation: 43,
		roomInUse: true,
	})
	assert.deepEqual(JSON.parse(muteMessage(true)), { audio: { mute: true } })
	assert.equal(parseSscMessage('not json'), null)
})

test('matches normal and north-crossing camera sectors', () => {
	assert.equal(azimuthInRange(120, 90, 150), true)
	assert.equal(azimuthInRange(10, 330, 30), true)
	assert.equal(azimuthInRange(180, 330, 30), false)
})
