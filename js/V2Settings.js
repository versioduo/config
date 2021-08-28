// © Kay Sievers <kay@vrfy.org>, 2019-2021
// SPDX-License-Identifier: Apache-2.0

class V2SettingsModule {
  device = null;
  settings = null;
  setting = null;

  constructor(device, settings, setting) {
    this.device = device;
    this.settings = settings;
    this.setting = setting;

    return Object.seal(this);
  }

  addTitle(canvas, text) {
    V2Web.addElement(canvas, 'h3', (e) => {
      e.classList.add('title');
      e.classList.add('subsection');
      e.textContent = text;
    });
  }

  getConfiguration(data) {
    const configuration = this.setting.configuration;

    // configuration.devices[3].count
    if (configuration.index != null && configuration.field)
      return data[configuration.path][configuration.index][configuration.field];

    // configuration.devices[3]
    if (configuration.index != null)
      return data[configuration.path][configuration.index];

    // configuration.devices.count
    if (configuration.field)
      return data[configuration.path][configuration.field];

    // configuration.device
    return data[configuration.path];
  }

  setConfiguration(data, value) {
    const configuration = this.setting.configuration;

    // configuration.devices[3].count
    if (configuration.index != null && configuration.field) {
      if (!data[configuration.path])
        data[configuration.path] = [];

      if (!data[configuration.path][configuration.index])
        data[configuration.path][configuration.index] = {};

      data[configuration.path][configuration.index][configuration.field] = value;
      return;
    }

    // configuration.devices[3]
    if (configuration.index != null) {
      if (!data[configuration.path])
        data[configuration.path] = [];

      data[configuration.path][configuration.index] = value;
      return;
    }

    // configuration.devices.count
    if (configuration.field) {
      if (!data[configuration.path])
        data[configuration.path] = {};

      data[configuration.path][configuration.field] = value;
      return;
    }

    // configuration.device
    data[configuration.path] = value;
  }
}

// The chromatic note calibration. Every note defines the the raw
// velociy values to play the velocities 1 and 127.
// The raw values are played by switching to a specific MIDI program.
class V2SettingsCalibration extends V2SettingsModule {
  static type = 'calibration';

  #device = null;
  #settings = null;
  #currentProgram = Object.seal({
    bank: 0,
    number: 0
  });
  #values = null;
  #playTimer = null;
  #notes = Object.seal({
    element: null,
    bank: 0,
    program: 0
  });

  constructor(device, settings, canvas, setting, data) {
    super(device, settings, setting);
    super.addTitle(canvas, 'Calibration');

    // Find current program.
    data.input.programs.find((program) => {
      if (!program.selected)
        return false;

      this.#currentProgram.bank = program.bank;
      this.#currentProgram.number = program.number;
      return true;
    });

    if (setting.program != null) {
      this.#notes.bank = setting.program.bank;
      this.#notes.program = setting.program.number;
    }

    const changeProgram = (program, bank) => {
      const msb = (bank >> 7) & 0x7f;
      const lsb = bank & 0x7f;
      this.device.sendControlChange(0, V2MIDI.CC.bankSelect, msb);
      this.device.sendControlChange(0, V2MIDI.CC.bankSelectLSB, lsb);
      this.device.sendProgramChange(0, program);
    };

    const playAll = (field) => {
      const reset = () => {
        clearInterval(this.#playTimer);
        this.#playTimer = null;
        changeProgram(this.#currentProgram.number, this.#currentProgram.bank);
      }

      if (this.#playTimer) {
        reset();
        return;
      }

      changeProgram(this.#notes.program, this.#notes.bank);

      let index = 0;
      this.#playTimer = setInterval(() => {
        const note = index + this.setting.chromatic.start;
        const velocity = this.#values[index][field];
        this.device.sendNote(0, note, velocity);

        index++;
        if (index == this.#values.length)
          reset();
      }, 150);
    }

    const playNote = (note, velocity) => {
      changeProgram(this.#notes.program, this.#notes.bank);
      this.device.sendNote(0, note, velocity);
      changeProgram(this.#currentProgram.number, this.#currentProgram.bank);
    }

    new V2WebField(canvas, (field) => {
      field.addButton((e) => {
        e.textContent = 'Play Min';
        e.title = 'Play all notes with velocity 1';
        e.addEventListener('click', () => {
          playAll('min');
        });
      });

      field.addButton((e) => {
        e.textContent = 'Play Max';
        e.title = 'Play all notes with velocity 127';
        e.addEventListener('click', () => {
          playAll('max');
        });
      });
    });

    const addCalibrationNote = (i, note) => {
      new V2WebField(canvas, (field) => {
        field.addButton((e) => {
          e.classList.add('width-label');
          e.classList.add('inactive');
          e.tabIndex = -1;
          e.textContent = V2MIDI.Note.name(note);
          e.classList.add(V2MIDI.Note.isBlack(note) ? 'is-dark' : 'has-background-grey-lighter');
        });

        field.addButton((e) => {
          e.title = 'Play note #' + note + ' with velocity 1';
          e.textContent = 'Min';
          e.addEventListener('mousedown', () => {
            playNote(note, this.#values[i].min);
          });
        });

        field.addInput('number', (e) => {
          e.classList.add('width-number');
          e.title = 'The raw value to play note #' + note + ' with velocity 1';
          e.min = 1;
          e.max = 127;
          e.value = this.#values[i].min;
          e.addEventListener('change', () => {
            this.#values[i].min = e.value
            playNote(note, this.#values[i].min);
          });
        });

        field.addButton((e) => {
          e.title = 'Play note #' + note + ' with velocity 127';
          e.textContent = 'Max';
          e.addEventListener('mousedown', () => {
            playNote(note, this.#values[i].max);
          });
        });

        field.addInput('number', (e) => {
          e.classList.add('width-number');
          e.title = 'The raw value to play the note #' + note + ' with velocity 127';
          e.min = 1;
          e.max = 127;
          e.value = this.#values[i].max;
          e.addEventListener('change', () => {
            this.#values[i].max = e.value;
            playNote(note, this.#values[i].max);
          });
        });
      });
    }

    const calibration = this.getConfiguration(data.configuration);
    this.#values = [];
    for (let i = 0; i < this.setting.chromatic.count; i++) {
      this.#values.push({
        'min': calibration[i].min,
        'max': calibration[i].max
      });
    }

    for (let i = 0; i < this.setting.chromatic.count; i++)
      addCalibrationNote(i, this.setting.chromatic.start + i);

    return Object.seal(this);
  }

  save(configuration) {
    this.setConfiguration(configuration, this.#values);
  }

  clear() {
    if (this.#playTimer) {
      clearInterval(this.#playTimer);
      this.#playTimer = null;
    }
  }
}

// HSV Color configuration.
class V2SettingsColor extends V2SettingsModule {
  static type = 'color';

  #color = Object.seal({
    element: null,
    h: 0,
    s: 0,
    v: 0
  });
  #hue = null;
  #saturation = null;
  #brightness = null;
  #configuration = null;

  #updateColor() {
    // Convert HSV to HSL.
    let s = 0;
    let l = this.#color.v * (1 - this.#color.s / 2);
    if (l > 0 && l < 1)
      s = (this.#color.v - l) / (l < 0.5 ? l : 1 - l);

    this.#color.element.style.backgroundColor = 'hsl(' + this.#color.h + ', ' + (s * 100) + '%, ' + (l * 100) + '%)';
  };

  constructor(device, settings, canvas, setting, data) {
    super(device, settings, setting);
    if (setting.title)
      super.addTitle(canvas, setting.title);

    this.#configuration = setting.configuration;
    new V2WebField(canvas, (field) => {
      field.addButton((e) => {
        e.classList.add('width-label');
        e.classList.add('has-background-grey-lighter');
        e.classList.add('inactive');
        e.tabIndex = -1;
        e.textContent = 'Color';
      });

      field.addButton((e) => {
        this.#color.element = e;
        e.classList.add('width-label');
        e.classList.add('inactive');
        e.tabIndex = -1;
      });
    });

    {
      let range = null;

      const update = (value) => {
        this.#color.h = value / 127 * 360;
        this.#hue.value = value;
        range.value = value;
        this.#updateColor();
      };

      new V2WebField(canvas, (field) => {
        field.addButton((e) => {
          e.classList.add('width-label');
          e.classList.add('has-background-grey-lighter');
          e.classList.add('inactive');
          e.tabIndex = -1;
          e.textContent = 'Hue';
        });

        field.addInput('number', (e) => {
          this.#hue = e;
          e.classList.add('width-number');
          e.title = 'The color';
          e.min = 0;
          e.max = 127;
          e.addEventListener('input', () => {
            update(e.value);
          });
        });
      });

      V2Web.addElement(canvas, 'input', (e) => {
        range = e;
        e.classList.add('range');
        e.type = 'range';
        e.title = 'The color';
        e.min = 0;
        e.max = 127;
        e.addEventListener('input', () => {
          update(e.value);
        });
      });

      update(this.getConfiguration(data.configuration)[0]);
    }

    {
      let range = null;

      const update = (value) => {
        this.#color.s = value / 127;
        this.#saturation.value = value;
        range.value = value;
        this.#updateColor();
      };

      new V2WebField(canvas, (field) => {
        field.addButton((e) => {
          e.classList.add('width-label');
          e.classList.add('has-background-grey-lighter');
          e.classList.add('inactive');
          e.tabIndex = -1;
          e.textContent = 'Saturation';
        });

        field.addInput('number', (e) => {
          this.#saturation = e;
          e.classList.add('width-number');
          e.title = 'The color saturation';
          e.min = 0;
          e.max = 127;
          e.addEventListener('input', () => {
            update(e.value);
          });
        });
      });

      V2Web.addElement(canvas, 'input', (e) => {
        range = e;
        e.classList.add('range');
        e.type = 'range';
        e.title = 'The color saturation';
        e.min = 0;
        e.max = 127;
        e.addEventListener('input', () => {
          update(e.value);
        });

        update(this.getConfiguration(data.configuration)[1]);
      });
    }

    {
      let range = null;

      const update = (value) => {
        this.#color.v = value / 127;
        this.#brightness.value = value;
        range.value = value;
        this.#updateColor();
      };

      new V2WebField(canvas, (field) => {
        field.addButton((e) => {
          e.classList.add('width-label');
          e.classList.add('has-background-grey-lighter');
          e.classList.add('inactive');
          e.tabIndex = -1;
          e.textContent = 'Brightness';
        });

        field.addInput('number', (e) => {
          this.#brightness = e;
          e.classList.add('width-number');
          e.title = 'The brightness';
          e.min = 0;
          e.max = 127;
          e.addEventListener('input', () => {
            update(e.value);
          });
        });
      });

      V2Web.addElement(canvas, 'input', (e) => {
        range = e;
        e.classList.add('range');
        e.type = 'range';
        e.title = 'The brightness';
        e.min = 0;
        e.max = 127;
        e.value = this.#brightness.value;
        e.addEventListener('input', () => {
          update(e.value);
        });
      });

      update(this.getConfiguration(data.configuration)[2]);
    }

    return Object.seal(this);
  }

  save(configuration) {
    this.setConfiguration(configuration, [
      this.#hue.value,
      this.#saturation.value,
      this.#brightness.value
    ]);
  }
}

// Single controller configuration.
class V2SettingsController extends V2SettingsModule {
  static type = 'controller';

  #controller = Object.seal({
    element: null,
  });

  constructor(device, settings, canvas, setting, data) {
    super(device, settings, setting);
    if (setting.title)
      super.addTitle(canvas, setting.title);

    let controller = null;
    let text = null;
    let range = null;

    const update = (number) => {
      controller.textContent = 'CC ' + number;
      text.textContent = V2MIDI.CC.Name[number] || 'Controller ' + number;
      this.#controller.element.value = number;
      range.value = number;
    }

    new V2WebField(canvas, (field) => {
      field.addButton((e) => {
        controller = e;
        e.classList.add('width-label');
        e.classList.add('has-background-grey-lighter');
        e.classList.add('inactive');
        e.tabIndex = -1;
      });

      field.addButton((e) => {
        text = e;
        e.classList.add('width-text-wide');
        e.classList.add('has-background-light');
        e.classList.add('inactive');
        e.tabIndex = -1;
      });

      field.addInput('number', (e) => {
        this.#controller.element = e;
        e.classList.add('width-number');
        e.title = 'The controller number';
        e.min = 0;
        e.max = 127;
        e.addEventListener('input', () => {
          update(e.value);
        });
      });
    });

    V2Web.addElement(canvas, 'input', (e) => {
      range = e;
      e.classList.add('range');
      e.type = 'range';
      e.title = 'The controller number';
      e.min = 0;
      e.max = 127;
      e.addEventListener('input', () => {
        update(e.value);
      });
    });

    update(this.getConfiguration(data.configuration));
    return Object.seal(this);
  }

  save(configuration) {
    this.setConfiguration(configuration, this.#controller.element.value);
  }
}

// Drum pad MIDI settings.
class V2SettingsDrum extends V2SettingsModule {
  static type = 'drum';

  #controller = null;
  #note = null;
  #sensitivity = null;

  constructor(device, settings, canvas, setting, data) {
    super(device, settings, setting);
    if (setting.title)
      super.addTitle(canvas, setting.title);

    const drum = this.getConfiguration(data.configuration);
    if (drum.controller != null) {
      let controller = null;
      let text = null;
      let range = null;

      const updateController = (number) => {
        if (number > 0) {
          controller.textContent = 'CC ' + number;
          text.textContent = V2MIDI.CC.Name[number] || 'Controller ' + number;

        } else {
          controller.textContent = null;
          text.textContent = 'Disabled';
        }
      };

      new V2WebField(canvas, (field) => {
        field.addButton((e) => {
          controller = e;
          e.classList.add('width-label');
          e.classList.add('has-background-grey-lighter');
          e.classList.add('inactive');
          e.tabIndex = -1;
        });

        field.addButton((e) => {
          text = e;
          e.classList.add('width-text-wide');
          e.classList.add('has-background-light');
          e.classList.add('inactive');
          e.tabIndex = -1;
        });

        field.addInput('number', (e) => {
          this.#controller = e;
          e.classList.add('width-number');
          e.title = 'The controller number';
          e.min = 0;
          e.max = 127;
          e.value = drum.controller;
          e.addEventListener('input', () => {
            updateController(e.value);
            range.value = e.value;
          });

          updateController(e.value);
        });
      });

      V2Web.addElement(canvas, 'input', (e) => {
        range = e;
        e.classList.add('range');
        e.type = 'range';
        e.title = 'The controller number';
        e.min = 0;
        e.max = 127;
        e.value = this.#controller.value;
        e.addEventListener('input', () => {
          this.#controller.value = Number(e.value);
          updateController(e.value);
        });
      });
    }

    if (drum.note != null) {
      let note = null;
      let range = null;

      const updateNote = (number) => {
        note.textContent = V2MIDI.Note.name(number);
        if (V2MIDI.Note.isBlack(number)) {
          note.classList.add('is-dark');
          note.classList.remove('has-background-grey-lighter');
        } else {
          note.classList.remove('is-dark');
          note.classList.add('has-background-grey-lighter');
        }
      }

      new V2WebField(canvas, (field) => {
        field.addButton((e) => {
          note = e;
          e.classList.add('width-label');
          e.classList.add('inactive');
          e.tabIndex = -1;
        });

        field.addInput('number', (e) => {
          this.#note = e;
          e.classList.add('width-number');
          e.title = 'The note number';
          e.min = 0;
          e.max = 127;
          e.value = drum.note;
          e.addEventListener('input', () => {
            updateNote(e.value);
            range.value = e.value;
          });

          updateNote(e.value);
        });
      });

      V2Web.addElement(canvas, 'input', (e) => {
        range = e;
        e.classList.add('range');
        e.type = 'range';
        e.title = 'The note number';
        e.min = 0;
        e.max = 127;
        e.value = this.#note.value;
        e.addEventListener('input', () => {
          this.#note.value = Number(e.value);
          updateNote(e.value);
        });
      });
    }

    if (drum.sensitivity != null) {
      let sensitivity = null;
      let range = null;

      new V2WebField(canvas, (field) => {
        field.addButton((e) => {
          sensitivity = e;
          e.classList.add('width-label');
          e.classList.add('inactive');
          e.classList.add('has-background-grey-lighter');
          e.tabIndex = -1;
          e.textContent = 'Sensitivity';
        });

        field.addInput('number', (e) => {
          this.#sensitivity = e;
          e.classList.add('width-label'); // -0.99 does not fit
          e.title = 'The sensitivity';
          e.min = -0.99;
          e.max = 0.99;
          e.step = 0.01;
          e.value = drum.sensitivity;
          e.addEventListener('input', () => {
            range.value = e.value;
          });
        });
      });

      V2Web.addElement(canvas, 'input', (e) => {
        range = e;
        e.classList.add('range');
        e.type = 'range';
        e.title = 'The sensitivity';
        e.min = -0.99;
        e.max = 0.99;
        e.step = 0.01;
        e.value = this.#sensitivity.value;
        e.addEventListener('input', () => {
          this.#sensitivity.value = Number(e.value);
        });
      });
    }

    return Object.seal(this);
  }

  save(configuration) {
    const drum = {};
    if (this.#controller)
      drum.controller = this.#controller.value

    if (this.#note)
      drum.note = this.#note.value

    if (this.#sensitivity)
      drum.sensitivity = this.#sensitivity.value

    this.setConfiguration(configuration, drum);
  }
}

// The MIDI properties. Some devices support to configure the outgoing MIDI channel.
class V2SettingsMIDI extends V2SettingsModule {
  static type = 'midi';

  #channel = Object.seal({
    element: null
  });

  constructor(device, settings, canvas, setting, data) {
    super(device, settings, setting);
    super.addTitle(canvas, 'MIDI');

    new V2WebField(canvas, (field) => {
      new V2WebField(canvas, (field) => {
        field.addButton((e) => {
          e.classList.add('width-label');
          e.classList.add('has-background-grey-lighter');
          e.classList.add('inactive');
          e.textContent = 'Channel';
          e.tabIndex = -1;
        });

        field.addElement('span', (e) => {
          e.classList.add('select');

          V2Web.addElement(e, 'select', (select) => {
            this.#channel.element = select;
            select.title = 'The MIDI Channel';

            for (let i = 1; i < 17; i++) {
              V2Web.addElement(select, 'option', (e) => {
                e.title = i;
                e.value = i;
                e.text = i;
                if (i == this.getConfiguration(data.configuration))
                  e.selected = true;
              });
            }
          });
        });
      });
    });

    return Object.seal(this);
  }

  save(configuration) {
    this.setConfiguration(configuration, this.#channel.element.value);
  }
}

// Text field.
class V2SettingsText extends V2SettingsModule {
  static type = 'text';

  #text = null;

  constructor(device, settings, canvas, setting, data) {
    super(device, settings, setting);
    if (setting.title)
      super.addTitle(canvas, setting.title);

    new V2WebField(canvas, (field) => {
      field.addButton((e) => {
        e.classList.add('width-label');
        e.classList.add('has-background-grey-lighter');
        e.classList.add('inactive');
        e.textContent = setting.label;
        e.tabIndex = -1;
      });

      field.addInput('text', (e) => {
        this.#text = e;
        e.classList.add('text-wide');
        e.maxLength = 31;
        e.value = this.getConfiguration(data.configuration);
      });
    });

    return Object.seal(this);
  }

  save(configuration) {
    this.setConfiguration(configuration, this.#text.value);
  }
}

// The USB properties. There is no settings entry specified. All devices
// support a custom name, the ports value is optional.
class V2SettingsUSB extends V2SettingsModule {
  static type = 'usb';

  #name = null;
  #ports = null;

  constructor(device, settings, canvas, setting, data) {
    super(device, settings, setting);
    super.addTitle(canvas, 'USB');

    new V2WebField(canvas, (field) => {
      field.addButton((e) => {
        e.classList.add('width-label');
        e.classList.add('has-background-grey-lighter');
        e.classList.add('inactive');
        e.textContent = 'Name';
        e.tabIndex = -1;
      });

      field.addInput('text', (e) => {
        this.#name = e;
        e.classList.add('text-wide');
        e.title = 'The USB device name';
        e.maxLength = 31;
        if (data.system.name)
          e.value = data.system.name;
        e.placeholder = data.metadata.product;
      });
    });

    // The number of MIDI ports.
    if (data.system.ports && data.system.ports.announce > 0) {
      new V2WebField(canvas, (field) => {
        field.addButton((e) => {
          e.classList.add('width-label');
          e.classList.add('has-background-grey-lighter');
          e.classList.add('inactive');
          e.textContent = 'Ports';
          e.tabIndex = -1;
        });

        field.addElement('span', (e) => {
          e.classList.add('select');

          V2Web.addElement(e, 'select', (select) => {
            this.#ports = select;
            select.title = 'The number of MIDI ports';

            for (let i = 1; i < 17; i++) {
              V2Web.addElement(select, 'option', (e) => {
                e.title = i;
                e.value = i;
                e.text = i;
                if (i == data.system.ports.configured)
                  e.selected = true;
              });
            }
          });
        });
      });
    }

    return Object.seal(this);
  }

  save(configuration) {
    configuration.usb = {
      'name': this.#name.value
    };

    if (this.#ports)
      configuration.usb.ports = Number(this.#ports.value);
  }
}
