# WebMIDI Device Configuration

A simple configuration tool for small MIDI devices. It runs in the web browser on a desktop or mobile phone without the need to download or install any additional software. It is suited for devices which do not have a network connection themselves.

The Web browser connects over [webMIDI](https://webaudio.github.io/web-midi-api/#extensions-to-the-navigator-interface) to the MIDI device. The messages between the browser and the device are [MIDI System Exclusive](https://en.wikipedia.org/wiki/MIDI#System_Exclusive_messages) messages.

The used MIDI System Exclusive ID is the _research/private ID_ `0x7d`. The  messages contain a single valid [JSON](https://www.json.org/json-en.html) object. The first byte of the message must be `{`, the last byte must be `}`. All unicode codepoints must be escaped with the `\u0000` notation to satisfy the MIDI 7 bit byte stream requirement; escaping and unescaping must support unicode [surrogate pairs](https://en.wikipedia.org/wiki/UTF-16#U+D800_to_U+DFFF).

All messages use the globally unique object `com.versioduo.device` with a simple method call convention.

The devices implement the JSON interface with [V2Device](https://github.com/versioduo/V2Device/) and send and receive MIDI System Exclusive messages with [V2MIDI](https://github.com/versioduo/V2MIDI/).

:bulb: _This application is copied into client-side storage; it can be used without an active network connection. Alternatively, this repository can be cloned or downloaded and used offline; it is fully self-contained, does not require or load anything from external resources._

## Request

A host connects to the device and calls the method `getAll()` of `com.versioduo.device`:

```json
{
  "com.versioduo.device": {
    "method": "getAll"
  }
}
```

## Reply

The device replies with a `com.versioduo.device` object.

### Metadata Section

The `metadata` object is a human-readable flat list of key/value pairs which describe the device.

### System Section

The `system` object is machine-readable information about the device, like the USB name, the number of MIDI ports, the available memory, ...

### Settings Section

The `settings` entries point to data objects in the configuration section, they provide metadata and properties to specific settings plugins.

### Configuration Section

The `configuration` object is the entire custom configuration of the device. The device configuration can be edited, and updated by calling the `writeConfiguration()` method with a new `configuration` object. The device is reset to factory defaults by calling the `eraseConfiguration()` method.

### MIDI Input Section

The `input` object lists the notes and controllers the device sends.

### MIDI Output Section

The `output` object lists the notes and controllers the device listens to.

## Example

A reply from the device:

```json
"com.versioduo.device": {
  "token": 4183794124,
  "metadata": {
    "vendor": "Versio Duo",
    "product": "glockenspiel-37",
    "description": "37 Bar Glockenspiel",
    "home": "https://versioduo.com/#glockenspiel-37",
    "serial": "4A7E4D075334574347202020FF021F46",
    "version": 39
  },
  "system": {
    "board": "versioduo:samd:control",
    "usb": {
      "vid": 26214,
      "pid": 59664
    },
    "ports": {
      "configured": 1,
      "announce": 6,
      "current": 1
    },
    "firmware": {
      "download": "https://versioduo.com/download",
      "configure": "https://versioduo.com/configure",
      "id": "com.versioduo.glockenspiel-37",
      "board": "versioduo:samd:control",
      "hash": "c890ec24736669d2b38b9502bcde6c20e0c9869f",
      "start": 16384,
      "size": 123119
    },
    "ram": {
      "size": 196608,
      "free": 51635
    },
    "flash": {
      "size": 524288
    },
    "eeprom": {
      "size": 4096
    },
    "boot": {
      "uptime": 41,
      "id": 4183794124
    },
    "input": {
      "packet": 33,
      "system": {
        "exclusive": 3
      }
    },
    "output": {
      "packet": 879,
      "system": {
        "exclusive": 1
      }
    }
  },
  "settings": [
    {
      "type": "calibration",
      "program": {
        "number": 9,
        "bank": 3
      },
      "chromatic": {
        "start": 72,
        "count": 37
      },
      "configuration": {
        "path": "calibration"
      }
    },
    {
      "type": "color",
      "title": "Light",
      "configuration": {
        "path": "color"
      }
    }
  ],
  "configuration": {
    "#usb": "The USB Settings",
    "usb": {
      "#name": "The device name",
      "name": "",
      "#ports": "The number of MIDI ports",
      "ports": 1
    },
    "#calibration": "The “Raw” velocity values to play a note with velocity 1 and 127",
    "calibration": [
      {
        "min": 48,
        "max": 127
      },
      {
        "min": 36,
        "max": 127
      },
      ...
      {
        "min": 59,
        "max": 127
      }
    ],
    "#color": "The LED color. Hue, saturation, brightness, 0..127",
    "color": [
      15,
      40,
      100
    ]
  },
  "input": {
    "programs": [
      {
        "name": "Standard",
        "number": 9,
        "bank": 0,
        "selected": true
      },
      {
        "name": "Damper",
        "number": 9,
        "bank": 1
      },
      {
        "name": "Trigger + Damper",
        "number": 9,
        "bank": 2
      },
      {
        "name": "Calibration",
        "number": 9,
        "bank": 3
      }
    ],
    "controllers": [
      {
        "name": "Volume",
        "number": 7,
        "value": 100
      },
      {
        "name": "Sustain",
        "number": 64,
        "value": 0
      },
      {
        "name": "Hue",
        "number": 14,
        "value": 15
      },
      {
        "name": "Saturation",
        "number": 15,
        "value": 40
      },
      {
        "name": "Brightness",
        "number": 89,
        "value": 100
      },
      {
        "name": "Rainbow",
        "number": 90,
        "value": 0
      }
    ],
    "chromatic": {
      "start": 72,
      "count": 37
    }
  }
}
```

## Screenshots

### Information

![Screenshot](screenshots/information.png?raw=true)

### Details

![Screenshot](screenshots/details.png?raw=true)

### Firmware Update

![Screenshot](screenshots/update.png?raw=true)

### Notes

![Screenshot](screenshots/notes.png?raw=true)

### System Configuration

![Screenshot](screenshots/system.png?raw=true)

### Test, Log

![Screenshot](screenshots/log.png?raw=true)

### Install as stand-alonde application

![Screenshot](screenshots/install.png?raw=true)
