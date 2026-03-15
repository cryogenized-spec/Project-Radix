export interface ComponentCategory {
  id: string;
  name: string;
  subcategories?: ComponentCategory[];
  items?: ComponentDef[];
}

export interface ComponentDef {
  id: string;
  name: string;
  type: string;
  description: string;
  dimensions: { x: number; y: number; z: number };
  ports: { id: string; label: string; x: number; y: number; z: number }[];
  preferredPlane?: "Wall" | "Floor" | "Ceiling";
  installationHeight?: number;
  LOD_Model?: string;
}

export const COMPONENT_LIBRARY: ComponentCategory[] = [
  {
    id: 'passive',
    name: 'Passive Components',
    subcategories: [
      {
        id: 'resistors',
        name: 'Resistors',
        items: [
          { id: 'res_1/4w', name: '1/4W Resistor', type: 'resistor', description: 'Standard through-hole resistor', dimensions: { x: 10, y: 3, z: 3 }, ports: [{ id: 'p1', label: '1', x: -5, y: 0, z: 0 }, { id: 'p2', label: '2', x: 5, y: 0, z: 0 }] },
          { id: 'res_1w', name: '1W Resistor', type: 'resistor', description: 'High power resistor', dimensions: { x: 15, y: 5, z: 5 }, ports: [{ id: 'p1', label: '1', x: -7.5, y: 0, z: 0 }, { id: 'p2', label: '2', x: 7.5, y: 0, z: 0 }] },
          { id: 'res_smd_0805', name: 'SMD Resistor 0805', type: 'resistor', description: 'Surface mount resistor', dimensions: { x: 2, y: 1.25, z: 0.5 }, ports: [{ id: 'p1', label: '1', x: -1, y: 0, z: 0 }, { id: 'p2', label: '2', x: 1, y: 0, z: 0 }] }
        ]
      },
      {
        id: 'capacitors',
        name: 'Capacitors',
        items: [
          { id: 'cap_cer_104', name: 'Ceramic Capacitor 100nF', type: 'capacitor', description: 'Standard decoupling capacitor', dimensions: { x: 5, y: 5, z: 2 }, ports: [{ id: 'p1', label: '1', x: -2.5, y: -2.5, z: 0 }, { id: 'p2', label: '2', x: 2.5, y: -2.5, z: 0 }] },
          { id: 'cap_elec_10uF', name: 'Electrolytic Capacitor 10uF', type: 'capacitor', description: 'Polarized capacitor', dimensions: { x: 5, y: 10, z: 5 }, ports: [{ id: 'pos', label: '+', x: -2, y: -5, z: 0 }, { id: 'neg', label: '-', x: 2, y: -5, z: 0 }] }
        ]
      },
      {
        id: 'inductors',
        name: 'Inductors',
        items: [
          { id: 'ind_10uH', name: 'Inductor 10uH', type: 'inductor', description: 'Through-hole inductor', dimensions: { x: 8, y: 10, z: 8 }, ports: [{ id: 'p1', label: '1', x: -4, y: -5, z: 0 }, { id: 'p2', label: '2', x: 4, y: -5, z: 0 }] }
        ]
      }
    ]
  },
  {
    id: 'active',
    name: 'Active Components',
    subcategories: [
      {
        id: 'diodes',
        name: 'Diodes & LEDs',
        items: [
          { id: 'led_5mm', name: '5mm LED', type: 'led', description: 'Standard 5mm Light Emitting Diode', dimensions: { x: 5, y: 8, z: 5 }, ports: [{ id: 'anode', label: 'A', x: -1.5, y: -4, z: 0 }, { id: 'cathode', label: 'K', x: 1.5, y: -4, z: 0 }] },
          { id: 'diode_1n4148', name: '1N4148 Signal Diode', type: 'diode', description: 'Fast switching diode', dimensions: { x: 8, y: 2, z: 2 }, ports: [{ id: 'anode', label: 'A', x: -4, y: 0, z: 0 }, { id: 'cathode', label: 'K', x: 4, y: 0, z: 0 }] }
        ]
      },
      {
        id: 'transistors',
        name: 'Transistors',
        items: [
          { id: 'trans_2n2222', name: '2N2222 NPN', type: 'transistor', description: 'NPN Bipolar Junction Transistor', dimensions: { x: 5, y: 5, z: 4 }, ports: [{ id: 'e', label: 'E', x: -2, y: -2.5, z: 0 }, { id: 'b', label: 'B', x: 0, y: -2.5, z: 0 }, { id: 'c', label: 'C', x: 2, y: -2.5, z: 0 }] },
          { id: 'mosfet_irfz44n', name: 'IRFZ44N MOSFET', type: 'transistor', description: 'N-Channel Power MOSFET', dimensions: { x: 10, y: 15, z: 4 }, ports: [{ id: 'g', label: 'G', x: -2.5, y: -7.5, z: 0 }, { id: 'd', label: 'D', x: 0, y: -7.5, z: 0 }, { id: 's', label: 'S', x: 2.5, y: -7.5, z: 0 }] }
        ]
      }
    ]
  },
  {
    id: 'ics',
    name: 'Integrated Circuits',
    subcategories: [
      {
        id: 'mcu',
        name: 'Microcontrollers',
        items: [
          { id: 'ic_atmega328p', name: 'ATmega328P', type: 'ic', description: '8-bit AVR Microcontroller (DIP-28)', dimensions: { x: 35, y: 8, z: 10 }, ports: [
            { id: 'p1', label: '1', x: -16, y: -4, z: 5 }, { id: 'p28', label: '28', x: -16, y: -4, z: -5 }
            // Simplified ports for brevity
          ] },
          { id: 'ic_attiny85', name: 'ATtiny85', type: 'ic', description: '8-bit AVR Microcontroller (DIP-8)', dimensions: { x: 10, y: 8, z: 10 }, ports: [
            { id: 'p1', label: '1', x: -4, y: -4, z: 5 }, { id: 'p8', label: '8', x: -4, y: -4, z: -5 }
          ] }
        ]
      },
      {
        id: 'logic',
        name: 'Logic Gates',
        items: [
          { id: 'ic_555', name: 'NE555 Timer', type: 'ic', description: 'Precision timing circuit (DIP-8)', dimensions: { x: 10, y: 8, z: 10 }, ports: [
            { id: 'p1', label: 'GND', x: -4, y: -4, z: 5 }, { id: 'p8', label: 'VCC', x: -4, y: -4, z: -5 }
          ] }
        ]
      }
    ]
  },
  {
    id: 'sensors',
    name: 'Sensors',
    subcategories: [
      {
        id: 'motion',
        name: 'Motion Sensors',
        items: [
          { id: 'pir_sensor', name: 'PIR Sensor', type: 'sensor', description: 'Passive Infrared Motion Sensor', dimensions: { x: 30, y: 25, z: 25 }, ports: [{ id: 'vcc', label: 'VCC', x: -10, y: -12.5, z: 0 }, { id: 'out', label: 'OUT', x: 0, y: -12.5, z: 0 }, { id: 'gnd', label: 'GND', x: 10, y: -12.5, z: 0 }], preferredPlane: 'Wall', installationHeight: 2000, LOD_Model: 'high_detail_pir' }
        ]
      },
      {
        id: 'vision',
        name: 'Vision Sensors',
        items: [
          { id: 'camera_module', name: 'Camera Module', type: 'sensor', description: 'OV7670 Camera Module', dimensions: { x: 35, y: 35, z: 20 }, ports: [{ id: 'vcc', label: 'VCC', x: -15, y: -17.5, z: 0 }, { id: 'gnd', label: 'GND', x: -10, y: -17.5, z: 0 }], preferredPlane: 'Wall', installationHeight: 2200, LOD_Model: 'high_detail_camera' }
        ]
      }
    ]
  },
  {
    id: 'boards',
    name: 'Development Boards',
    subcategories: [
      {
        id: 'esp',
        name: 'ESP Boards',
        items: [
          { id: 'esp32_dev', name: 'ESP32 Dev Board', type: 'board', description: 'ESP32 Development Board', dimensions: { x: 50, y: 25, z: 10 }, ports: [{ id: 'vin', label: 'VIN', x: -20, y: -12.5, z: 0 }, { id: 'gnd', label: 'GND', x: -15, y: -12.5, z: 0 }], preferredPlane: 'Wall', installationHeight: 1500, LOD_Model: 'high_detail_esp32' }
        ]
      }
    ]
  },
  {
    id: 'electromechanical',
    name: 'Electromechanical',
    subcategories: [
      {
        id: 'motors',
        name: 'Motors & Actuators',
        items: [
          { id: 'motor_dc_130', name: 'DC Motor 130', type: 'motor', description: 'Standard 3V-6V DC Motor', dimensions: { x: 20, y: 15, z: 15 }, ports: [{ id: 'pos', label: '+', x: -10, y: 0, z: 5 }, { id: 'neg', label: '-', x: -10, y: 0, z: -5 }] },
          { id: 'servo_sg90', name: 'SG90 Micro Servo', type: 'motor', description: '9g Micro Servo', dimensions: { x: 22, y: 22, z: 12 }, ports: [{ id: 'gnd', label: 'GND', x: -11, y: -11, z: 0 }, { id: 'vcc', label: 'VCC', x: -11, y: -11, z: 2 }, { id: 'sig', label: 'SIG', x: -11, y: -11, z: 4 }] }
        ]
      },
      {
        id: 'switches',
        name: 'Switches & Relays',
        items: [
          { id: 'sw_push', name: 'Push Button', type: 'switch', description: 'Tactile push button 6x6mm', dimensions: { x: 6, y: 5, z: 6 }, ports: [{ id: 'p1', label: '1', x: -3, y: -2.5, z: 3 }, { id: 'p2', label: '2', x: 3, y: -2.5, z: 3 }] },
          { id: 'relay_5v', name: '5V Relay', type: 'relay', description: 'SPDT 5V Relay', dimensions: { x: 15, y: 15, z: 20 }, ports: [{ id: 'coil1', label: 'C1', x: -5, y: -7.5, z: 5 }, { id: 'coil2', label: 'C2', x: 5, y: -7.5, z: 5 }] }
        ]
      }
    ]
  }
];
