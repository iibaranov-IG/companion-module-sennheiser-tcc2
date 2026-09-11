# Companion module for Sennheiser TeamConnect Ceiling 2

Receives the active-talker direction from a TCC2 over Sennheiser Sound Control Protocol v1 (SSCv1) and makes it useful inside Bitfocus Companion.

## Implemented

- Real-time SSC subscription over UDP port 45
- Active beam azimuth and elevation variables
- Room-in-use and microphone mute variables/feedbacks
- Azimuth-sector feedback, including sectors that cross 0°, for camera preset triggers
- Mute/unmute and explicit status refresh actions
- Device product, firmware and serial variables
- Subscription renewal, fallback polling and a silence watchdog

## Hardware status

The protocol messages, partial-response parser and wrapped camera-sector logic are covered by automated tests. Physical TCC2 verification is still requested before production use.

Requested in [bitfocus/companion-module-requests#2061](https://github.com/bitfocus/companion-module-requests/issues/2061). Protocol reference: [Sennheiser SSC for TCC2](https://assets.sennheiser.com/download/assets/TI_1245_v1.8.0_Sennheiser_Sound_Control_Protocol_TCC2_EN.pdf/c204169ce7bb11f0a354ea55b5d2fb86).

License: MIT.
