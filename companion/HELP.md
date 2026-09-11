# Sennheiser TeamConnect Ceiling 2

## Configuration

Enter the TCC2 IP address. SSCv1 uses UDP port `45`. Companion and the microphone must be able to exchange UDP packets in both directions.

The module subscribes to beam position, room activity and mute changes, renews that subscription automatically and also performs a periodic full query.

## Camera tracking

Create one **Beam is inside azimuth sector** feedback per camera preset. Enter the sector boundaries in degrees. A sector from `330` to `30` correctly crosses north/0°. Combine the sector feedback with **Room is in use** so the last held beam angle does not select a camera during silence.

## Actions

- Refresh state
- Mute or unmute the microphone

## Variables

`beam_azimuth`, `beam_elevation`, `room_in_use`, `muted`, `product`, `firmware`, `serial` and `last_update`.

This implementation follows Sennheiser SSCv1. Physical TCC2 validation is still requested before production use.
